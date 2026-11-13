"""Create a readable CSV of expanded publication metadata from cached card JSON."""
import argparse
import json
from pathlib import Path

from match_elibrary_lists import write_csv
from parse_elibrary import DEFAULT_WORK


def export_details(cards,output):
    rows=[]
    for path in sorted(Path(cards).glob('*.json')):
        card=json.loads(path.read_text(encoding='utf8'))
        authors=card.get('authors',[])
        rows.append({'elibrary_id':card['elibrary_id'],'title':card.get('title',''),
            'publication_year':card.get('publication_year'),'publication_type':card.get('publication_type',''),
            'authors':'; '.join(a.get('full_name') or a['name'] for a in authors),
            'affiliations':'; '.join(sorted({org for a in authors for org in a.get('affiliations',[])})),
            'abstract':card.get('abstract') or '', 'keywords':'; '.join(card.get('keywords',[])),
            'doi':card.get('doi') or '', 'edn':card.get('edn') or '', 'source_url':card.get('source_url','')})
    write_csv(Path(output),['elibrary_id','title','publication_year','publication_type','authors','affiliations',
                           'abstract','keywords','doi','edn','source_url'],rows)
    return len(rows)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cards',type=Path,default=DEFAULT_WORK/'sample/enrichment/cards')
    parser.add_argument('--output',type=Path,default=DEFAULT_WORK/'sample/publication_details.csv')
    args=parser.parse_args()
    print(export_details(args.cards,args.output))
