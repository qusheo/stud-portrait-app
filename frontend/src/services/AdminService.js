import Api from '@src/api.js';
import BaseService from './BaseService';

class AdminService extends BaseService {
    /**
     * Вузы
     */
    getInstitutions() {
        return this.request(() => Api.getInstitutions(), 'Ошибка загрузки вузов');
    }

    /**
     * Опции фильтров
     */
    getFilterOptions(institute) {
        return this.request(() => Api.getFilterOptions(institute), 'Ошибка загрузки фильтров');
    }

    /**
     * Статистика dashboard
     */
    getDashboardStats(institute, specialty, year) {
        return this.request(() => Api.getDashboardStats(institute, specialty, year), 'Ошибка загрузки статистики');
    }

    /**
     * Мотиваторы
     */
    getMotivatorStatistics(filters) {
        return this.request(() => Api.getMotivatorStatistics(filters), 'Ошибка загрузки статистики мотиваторов');
    }

    /**
     * Количество мотиваций
     */
    getMotivationCounts(institute, specialty, year) {
        return this.request(() => Api.getMotivationCounts(institute, specialty, year), 'Ошибка загрузки мотиваций');
    }

    /**
     * VAM студента
     */
    getAnalyzeStudentVam(studentId, competency) {
        return this.request(() => Api.getAnalyzeStudentVam(studentId, competency), 'Ошибка анализа VAM');
    }

    /**
     * LGM когорт
     */
    postAnalyzeCohortLgm(competency, institutionIds = [], directionIds = [], groupBy = 'institution') {
        return this.request(() => Api.postAnalyzeCohortLgm(competency, institutionIds, directionIds, groupBy), 'Ошибка анализа LGM');
    }

    /**
     * Анализ дисциплин
     */
    getAllDisciplinesImpact() {
        return this.request(() => Api.getAnalyzeAllDisciplinesImpact(), 'Ошибка анализа дисциплин');
    }

    /**
     * Список дисциплин
     */
    getDisciplines() {
        return this.request(() => Api.getPortraitGetDisciplines(), 'Ошибка загрузки дисциплин');
    }

    /**
     * Тепловая карта
     */
    getDisciplineHeatmapData(institutionIds = [], directionIds = []) {
        return this.request(() => Api.postGetDisciplineHeatmapData(institutionIds, directionIds), 'Ошибка загрузки тепловой карты');
    }

    /**
     * Центры по регионам
     */
    getCentersByRegion(year) {
        return this.request(() => Api.getPortraitCentersByRegion(year), 'Ошибка загрузки центров');
    }

    /**
     * Дубли аккаунтов
     */
    getDuplicateAccounts() {
        return this.request(() => Api.getDuplicateAccounts(), 'Ошибка загрузки дублей');
    }
}

export default new AdminService();
