import Api from '../api.js';
import BaseService from './BaseService.js';

type RequirementLevel = 'medium' | 'high';
type RequirementCategory = 'competencies' | 'motivators' | 'values';

export interface StudentRequirementsInput {
    requirements?: Partial<Record<RequirementCategory, Record<string, RequirementLevel>>>;
    specialtyIds?: number[];
    courses?: number[];
    limit?: number;
    offset?: number;
}

class StudentService extends BaseService {
    /**
     * Получение портрета студента
     */
    getStudentPortrait(studentId: number) {
        return this.request(() => Api.getStudentPortrait(studentId), 'Ошибка загрузки портрета студента');
    }

    /**
     * Результаты студента
     */
    getStudentResults(studentId: number) {
        return this.request(() => Api.getPortraitStudentResults(studentId), 'Ошибка загрузки результатов студента');
    }

    /**
     * Сравнение статистики студента
     */
    getStudentComparisonStats(studentId: number, year?: number | string) {
        return this.request(() => Api.getStudentComparisonStats(studentId, year), 'Ошибка загрузки статистики сравнения');
    }

    /**
     * Влияние дисциплин на студента
     */
    getStudentDisciplineImpact(studentId: number) {
        return this.request(() => Api.getStudentDisciplineImpact(studentId), 'Ошибка анализа дисциплин');
    }

    getAnalyzeStudentVam(studentId: number, competency?: string) {
        return this.request(() => Api.getAnalyzeStudentVam(studentId, competency), 'Ошибка анализа VAM');
    }

    /**
     * Получение списка студентов
     */
    getStudentsList(search: string = '', limit: number = 50) {
        return this.request(() => Api.getStudentsList(search, limit), 'Ошибка загрузки студентов');
    }

    /**
     * Данные резюме студента
     */
    getStudentResumeData(studentId: number, year: number | string) {
        return this.request(() => Api.getStudentResumeData(studentId, year), 'Ошибка загрузки резюме');
    }

    generateDocxResume(studentId: number) {
        return Api.windowGenerateDocxResume(studentId);
    }

    getCourses() {
        return this.request(() => Api.getPortraitCourses(), 'Ошибка загрузки курсов');
    }

    /**
     * Оценки и компетенции
     */
    getGradesCompetencyCorrelation(
        institute?: number | string,
        specialty?: number | string,
        year?: number | string,
        discipline?: string,
        competency?: string
    ) {
        return this.request(
            () => Api.getGradesCompetencyCorrelation(institute, specialty, year, discipline, competency),
            'Ошибка получения корреляции'
        );
    }

    getStudentByRequirements(input: StudentRequirementsInput = {}) {
        return this.request(
            () => Api.getStudentByRequirements(input),
            'Ошибка поиска студентов'
        );
    }
}

export default new StudentService();
