import Api from '../api.js';
import BaseService from './BaseService';

class StudentService extends BaseService {
    /**
     * Получение портрета студента
     */
    getStudentPortrait(studentId) {
        return this.request(() => Api.getStudentPortrait(studentId), 'Ошибка загрузки портрета студента');
    }

    /**
     * Результаты студента
     */
    getStudentResults(studentId) {
        return this.request(() => Api.getPortraitStudentResults(studentId), 'Ошибка загрузки результатов студента');
    }

    /**
     * Сравнение статистики студента
     */
    getStudentComparisonStats(studentId, year) {
        return this.request(() => Api.getStudentComparisonStats(studentId, year), 'Ошибка загрузки статистики сравнения');
    }

    /**
     * Влияние дисциплин на студента
     */
    getStudentDisciplineImpact(studentId) {
        return this.request(() => Api.getStudentDisciplineImpact(studentId), 'Ошибка анализа дисциплин');
    }

    /**
     * Получение списка студентов
     */
    getStudentsList(search = '', limit = 50) {
        return this.request(() => Api.getStudentsList(search, limit), 'Ошибка загрузки студентов');
    }

    /**
     * Данные резюме студента
     */
    getStudentResumeData(studentId, year) {
        return this.request(() => Api.getStudentResumeData(studentId, year), 'Ошибка загрузки резюме');
    }

    generateDocxResume(studentId) {
        return Api.windowGenerateDocxResume(studentId);
    }

    /**
     * Курсы
     */
    getCourses() {
        return this.request(() => Api.getPortraitCourses(), 'Ошибка загрузки курсов');
    }

    /**
     * Оценки и компетенции
     */
    getGradesCompetencyCorrelation(institute, specialty, year, discipline, competency) {
        return this.request(
            () => Api.getGradesCompetencyCorrelation(institute, specialty, year, discipline, competency),
            'Ошибка получения корреляции'
        );
    }
}

export default new StudentService();
