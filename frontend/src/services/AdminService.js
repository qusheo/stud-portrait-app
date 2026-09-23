import Api from '../api.js';
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
     * Динамика компетенций по курсам
     */
    getCompetencyTrendByYear(institute, specialty) {
        return this.request(() => Api.getCompetencyTrendByYear(institute, specialty), 'Ошибка загрузки динамики компетенций');
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

    getScoresResult(institute, specialty, year) {
        return this.request(() => Api.getScoresResult(institute, specialty, year), 'Ошибка загрузки результатов');
    }

    getGradesCompetencyCorrelation(institute, specialty, year, discipline, competency) {
        return this.request(
            () => Api.getGradesCompetencyCorrelation(institute, specialty, year, discipline, competency),
            'Ошибка получения корреляции'
        );
    }

    getCompetencySegmentation(filters) {
        return this.request(() => Api.getCompetencySegmentation(filters), 'Ошибка сегментации компетенций');
    }

    getTopCorrelations(filters) {
        return this.request(() => Api.getTopCorrelations(filters), 'Ошибка загрузки корреляций');
    }

    getGeographyReport(year) {
        return Api.getGeographyReport(year).then(response => {
            if (!response.ok) throw new Error('Ошибка загрузки географического отчета');
            return response.blob();
        });
    }

    getCourses() {
        return this.request(() => Api.getPortraitCourses(), 'Ошибка загрузки курсов');
    }

    getInstitutionDirections(institutionIds) {
        return this.request(() => Api.getPortraitGetInstitutionDirections(institutionIds), 'Ошибка загрузки направлений');
    }

    getFilterOptionsWithCounts(sessionId, institutionIds, directionIds, courses, testAttempts, competencies) {
        return this.request(
            () => Api.getPortraitGetFilterOptionsWithCounts(sessionId, institutionIds, directionIds, courses, testAttempts, competencies),
            'Ошибка загрузки фильтров'
        );
    }

    postDataseshNew() {
        return this.request(() => Api.postPortraitDataseshNew(), 'Ошибка создания сессии');
    }

    postDataseshExtractData(sessionId) {
        return this.request(() => Api.postPortraitDataseshExtractData(sessionId), 'Ошибка загрузки данных');
    }

    postDataseshUpdateFilters(sessionId, filters) {
        return this.request(() => Api.postPortraitDataseshUpdateFilters(sessionId, filters), 'Ошибка обновления фильтров');
    }

    postDataseshUpdateColumns(sessionId, columns) {
        return this.request(() => Api.postPortraitDataseshUpdateColumns(sessionId, columns), 'Ошибка обновления столбцов');
    }

    postDataseshUpdateWindow(sessionId, start, end) {
        return this.request(() => Api.postPortraitDataseshUpdateWindow(sessionId, start, end), 'Ошибка загрузки данных');
    }

    postDataseshExportSelected(sessionId, selectedIds) {
        return Api.postPortraitDataseshExportSelected(sessionId, selectedIds).then(response => {
            if (!response.ok) throw new Error('Ошибка экспорта данных');
            return response.blob();
        });
    }

    postDataseshCountStats(sessionId) {
        return this.request(() => Api.postPortraitDataseshCountStats(sessionId), 'Ошибка загрузки статистики');
    }

    postDataseshGroupSelected(sessionId, selectedIds, groupingColumn) {
        return this.request(
            () => Api.postPortraitDataseshGroupSelected(sessionId, selectedIds, groupingColumn),
            'Ошибка группировки данных'
        );
    }

    postAiAnalyticsSummary(contextType, filters) {
        return this.request(() => Api.postAiAnalyticsSummary(contextType, filters), 'Ошибка AI-аналитики');
    }

    getAnalyzeTransfers(queryString = '') {
        return this.request(() => Api.getAnalyzeTransfers(queryString), 'Ошибка анализа переводов');
    }

    postAnalyzeTransferStudents(body) {
        return this.request(() => Api.postAnalyzeTransferStudents(body), 'Ошибка анализа студентов');
    }

    getPossibleDuplicateAccounts() {
        return this.request(() => Api.getPossibleDuplicateAccounts(), 'Ошибка загрузки дублей');
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

    postAnalyzeDisciplineImpactAdvanced(competencies, disciplines, institutionIds, directionIds, limit) {
        return this.request(
            () => Api.postAnalyzeDisciplineImpactAdvanced(competencies, disciplines, institutionIds, directionIds, limit),
            'Ошибка анализа дисциплин'
        );
    }

    postGetLgmGrowers(competency, groupBy, groupId, institutionIds = [], directionIds = []) {
        return this.request(
            () => Api.postGetLgmGrowers(competency, groupBy, groupId, institutionIds, directionIds),
            'Ошибка загрузки студентов LGM'
        );
    }

    postGetCompetencyLevelFlow(competency, institutionIds, directionIds) {
        return this.request(() => Api.postGetCompetencyLevelFlow(competency, institutionIds, directionIds), 'Ошибка анализа уровней');
    }

    postGetCompetencyLevelFlowYearly(competency, institutionIds, directionIds) {
        return this.request(
            () => Api.postGetCompetencyLevelFlowYearly(competency, institutionIds, directionIds),
            'Ошибка анализа уровней по годам'
        );
    }

    postGetVamTrendData(body) {
        return this.request(() => Api.postGetVamTrendData(body), 'Ошибка загрузки динамики VAM');
    }

    postGetBoxplotData(competency, institutionIds, directionIds, groupBy) {
        return this.request(() => Api.postGetBoxplotData(competency, institutionIds, directionIds, groupBy), 'Ошибка загрузки boxplot');
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
