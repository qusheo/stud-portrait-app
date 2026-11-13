"""Reproducible sparse lexical TF-IDF title vectors and cosine search, offline."""
import argparse
from collections import Counter
from contextlib import closing
import hashlib
import heapq
import json
import math
from pathlib import Path
import re
import sqlite3
from functools import lru_cache

from parse_elibrary import DEFAULT_WORK, atomic_write, digest

STOP_WORDS=set('для при по из на об от до во со за под над это как или что the and for with from into of in on to an'.split())
STOP_WORDS.update('другой данный настоящий этот который такой весь также очень более наиболее являться иметь мочь некоторый наш ваш свой один рассмотрение работа статья исследование'.split())

@lru_cache(maxsize=1)
def morphology():
    import pymorphy3
    return pymorphy3.MorphAnalyzer()

@lru_cache(maxsize=200000)
def lemma(word):
    if not re.search('[а-я]',word):
        return word,None
    parsed=morphology().parse(word)[0]
    return parsed.normal_form.replace('ё','е'),parsed.tag.POS


def tokens(value,field=None):
    result=[]
    for part in re.split(r'[.!?;:,\n()]+',value):
        previous=None
        phrase=[]
        for word in re.findall(r'[^\W\d_]{2,}',part.casefold().replace('ё','е'),re.UNICODE):
            term,pos=lemma(word)
            if term in STOP_WORDS or pos in {'PREP','CONJ','PRCL','INTJ','NPRO'}:
                previous=None
                continue
            result.append(term)
            phrase.append(term)
            if previous:
                result.append(previous+' '+term)
            previous=term
        if field=='keywords' and len(phrase)>2:
            result.append(' '.join(phrase))
    return result


def fit(titles,max_features=10000,min_df=2,field=None):
    frequency=Counter()
    for title in titles:
        frequency.update(set(tokens(title,field)))
    selected=sorted((term for term,df in frequency.items() if df>=min_df),key=lambda term:(-frequency[term],term))[:max_features]
    vocabulary=sorted(selected)
    if not vocabulary:
        raise ValueError('Нет слов для векторизации; проверьте min_df и названия.')
    model={'kind':'lemma_phrase_tfidf_v2','document_count':len(titles),'min_df':min_df,'max_features':max_features,
        'vocabulary':vocabulary,'idf':[math.log((1+len(titles))/(1+frequency[term]))+1 for term in vocabulary],
        'stop_words':sorted(STOP_WORDS),'normalization':'L2','tf':'1+log(count)',
        'tokenization':'pymorphy3_ru_lemmas_unigrams_adjacent_bigrams_v2','language_note':'Лемматизация русского текста, стоп-слова, униграммы и соседние биграммы; без нейросетевой семантики.'}
    model['model_id']='tfidf-title-'+digest(json.dumps(model,ensure_ascii=False,sort_keys=True))[:20]
    if field:
        model['field']=field
    return model


def encode(title,model,lookup=None):
    lookup=lookup or {word:i for i,word in enumerate(model['vocabulary'])}
    counts=Counter(tokens(title,model.get('field')))
    values=sorted((lookup[word],(1+math.log(count))*model['idf'][lookup[word]])
                  for word,count in counts.items() if word in lookup)
    norm=math.sqrt(sum(weight*weight for _,weight in values))
    return [i for i,_ in values],[weight/norm for _,weight in values] if norm else []


def build(source,target,max_features=10000,min_df=2):
    source,target=Path(source),Path(target)
    if source.resolve()==target.resolve():
        raise ValueError('Векторизация должна создавать отдельную копию базы.')
    target.parent.mkdir(parents=True,exist_ok=True)
    temporary=target.with_suffix('.building.sqlite3')
    with closing(sqlite3.connect(source.resolve().as_uri()+'?mode=ro',uri=True)) as conn:
        rows=conn.execute('SELECT elibrary_id,title FROM publications ORDER BY elibrary_id').fetchall()
        with closing(sqlite3.connect(temporary)) as dest:
            conn.backup(dest)
    model=fit([title for _,title in rows],max_features,min_df)
    lookup={word:i for i,word in enumerate(model['vocabulary'])}
    zero=0
    with closing(sqlite3.connect(temporary)) as conn:
        conn.execute('PRAGMA foreign_keys=ON')
        conn.executescript('''
            DROP TABLE IF EXISTS publication_title_vectors;
            DROP TABLE IF EXISTS title_vector_models;
            CREATE TABLE title_vector_models (model_id TEXT PRIMARY KEY,kind TEXT NOT NULL,config TEXT NOT NULL);
            CREATE TABLE publication_title_vectors (elibrary_id INTEGER PRIMARY KEY REFERENCES publications,
                model_id TEXT NOT NULL REFERENCES title_vector_models,input_hash TEXT NOT NULL,
                dimensions INTEGER NOT NULL,indices TEXT NOT NULL,weights TEXT NOT NULL);
        ''')
        with conn:
            conn.execute('INSERT INTO title_vector_models VALUES (?,?,?)',
                (model['model_id'],model['kind'],json.dumps(model,ensure_ascii=False)))
            for item_id,title in rows:
                indices,weights=encode(title,model,lookup)
                zero+=not bool(indices)
                conn.execute('INSERT INTO publication_title_vectors VALUES (?,?,?,?,?,?)',
                    (item_id,model['model_id'],digest(title),len(lookup),json.dumps(indices),json.dumps(weights)))
            report={'model_id':model['model_id'],'kind':model['kind'],'publications':len(rows),
                    'dimensions':len(lookup),'empty_vectors':zero,'representation':'sparse_lexical_tfidf',
                    'source_database_sha256':hashlib.sha256(source.read_bytes()).hexdigest()}
            conn.execute('INSERT OR REPLACE INTO dataset_metadata VALUES (?,?)',('title_vectorization',json.dumps(report,ensure_ascii=False)))
            old_limits=conn.execute("SELECT value FROM dataset_metadata WHERE key='limitations'").fetchone()
            if old_limits:
                limits=[value for value in json.loads(old_limits[0]) if not value.startswith('Нет аннотаций, ключевых слов и векторов;')]
                card_count=conn.execute('SELECT count(*) FROM card_metadata').fetchone()[0]
                limits.append(f'Метаданные подробных карточек доступны только для {card_count} публикаций.')
                limits.append(f'Векторы названий — лексический TF-IDF с лемматизацией и словосочетаниями; пустых векторов: {zero}.')
                conn.execute('UPDATE dataset_metadata SET value=? WHERE key=?',
                             (json.dumps(limits,ensure_ascii=False),'limitations'))
        if conn.execute('PRAGMA integrity_check').fetchone()[0]!='ok' or conn.execute('PRAGMA foreign_key_check').fetchall():
            raise ValueError('Проверка базы после векторизации не пройдена.')
    temporary.replace(target)
    atomic_write(target.parent/'title_vector_model.json',json.dumps(model,ensure_ascii=False))
    atomic_write(target.parent/'title_vector_summary.json',json.dumps(report,ensure_ascii=False,indent=2))
    return report


def search(database,query,limit=10):
    with closing(sqlite3.connect(Path(database).resolve().as_uri()+'?mode=ro',uri=True)) as conn:
        model=json.loads(conn.execute('SELECT config FROM title_vector_models').fetchone()[0])
        indices,weights=encode(query,model)
        query_vector=dict(zip(indices,weights))
        def scored():
            for item_id,title,encoded_indices,encoded_weights in conn.execute('''SELECT p.elibrary_id,p.title,v.indices,v.weights
                FROM publication_title_vectors v JOIN publications p USING(elibrary_id)'''):
                score=sum(query_vector.get(i,0)*w for i,w in zip(json.loads(encoded_indices),json.loads(encoded_weights)))
                if score>0:
                    yield score,item_id,title
        return [{'score':round(score,6),'elibrary_id':item_id,'title':title}
                for score,item_id,title in heapq.nlargest(limit,scored())]


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command',choices=('build','search'))
    parser.add_argument('--source',type=Path,default=DEFAULT_WORK/'sample/analysis.refined.sqlite3')
    parser.add_argument('--database',type=Path,default=DEFAULT_WORK/'sample/analysis.ready.sqlite3')
    parser.add_argument('--query')
    parser.add_argument('--limit',type=int,default=10)
    args=parser.parse_args()
    if args.command=='build':
        result=build(args.source,args.database)
    else:
        if not args.query or args.limit<1:
            parser.error('Для поиска нужны --query и --limit >= 1')
        result=search(args.database,args.query,args.limit)
    print(json.dumps(result,ensure_ascii=False,indent=2))


if __name__=='__main__':
    main()
