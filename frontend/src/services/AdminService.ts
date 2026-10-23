import Api from '../api.js';
import BaseService from './BaseService.js';

type BoxplotGroupBy = 'auto' | 'institution' | 'direction';
type LgmGroupBy = 'institution' | 'direction';
type MotivatorGroupBy = 'specialty' | 'course' | 'specialty_course';
type AnalyticsFilters = {
    institute?: number | string | null;
    specialty?: number | string | null;
    year?: number | string | null;
};
type StudentListFilters = {
    specialties?: number | string[];
    year?: number | string | null;
    include_motivators?: boolean;
    include_values?: boolean;
};
type CompetencyCorrelationFilters = AnalyticsFilters & {
    topN?: number;
    sortBy?: 'abs' | 'positive' | 'negative';
    minN?: number;
};
type CompetencySegmentationFilters = AnalyticsFilters & {
    competency: string;
    motivatorThreshold?: number;
};
type DataSessionFilter =
    | { id: string; type: 'categorial'; field: string; categories: Array<string | number> }
    | { id: string; type: 'numeric'; field: string; min: number; max: number };
type TransferStudentsInput = {
    institution_id?: number | string | null;
    competency?: string;
    transfer_type?: '' | 'institution' | 'direction' | 'both';
    limit?: number;
};
type VamTrendInput = {
    group_by?: 'institution' | 'direction';
    competency?: string;
    selected_groups?: number | string[];
    filter_institutions?: number | string[];
    filter_directions?: number | string[];
    filter_courses?: number | string[];
};

class AdminService extends BaseService {
    /**
     * Вузы
     */
    getInstitutions() {
        return this.request(() => Api.getInstitutions(), 'Ошибка загрузки вузов');
    }

    async getAvailableYears() {
        const response = await Api.getAvailableYears();
        if (!response) throw new Error();
        const data = await response.json();
        return data?.data;
    }
    /**
     * Опции фильтров
     */
    getFilterOptions(institute?: number | string) {
        return this.request(() => Api.getFilterOptions(institute), 'Ошибка загрузки фильтров');
    }

    /**
     * Статистика dashboard
     */
    getDashboardStats(filters: AnalyticsFilters) {
        return this.request(
            () => Api.getDashboardStats(filters.institute, filters.specialty, filters.year),
            'Ошибка загрузки статистики'
        );
    }

    getCompetencyAverageByYears(institute?: number | string, specialty?: number | string) {
        return this.request(() => Api.getCompetencyAverageByYears(institute, specialty));
    }
    /**
     * Динамика компетенций по курсам
     */
    getCompetencyTrendByYear(institute?: number | string, specialty?: number | string) {
        return this.request(() => Api.getCompetencyTrendByYear(institute, specialty), 'Ошибка загрузки динамики компетенций');
    }

    /**
     * Мотиваторы
     */
    getMotivatorStatistics(filters: AnalyticsFilters & { group_by?: MotivatorGroupBy }) {
        return this.request(() => Api.getMotivatorStatistics(filters), 'Ошибка загрузки статистики мотиваторов');
    }

    getEducationProfilesComparison(filters: StudentListFilters) {
        return this.request(() => Api.getEducationProfilesComparison(filters), 'Ошибка сравнения профилей');
    }

    postParseCurriculum() {
        return this.request(() => Api.postParseCurriculum(), 'Ошибка запуска парсера учебного плана');
    }

    getParseCurriculumLog() {
        return this.request(() => Api.getParseCurriculumLog(), 'Ошибка загрузки журнала парсера');
    }

    getParseCurriculumMappings() {
        return this.request(() => Api.getParseCurriculumMappings(), 'Ошибка загрузки маппингов');
    }

    /**
     * Количество мотиваций
     */
    getMotivationCounts(institute?: number | string, specialty?: number | string, year?: number | string) {
        return this.request(() => Api.getMotivationCounts(institute, specialty, year), 'Ошибка загрузки мотиваций');
    }

    getScoresResult(institute?: number | string, specialty?: number | string, year?: number | string) {
        return this.request(() => Api.getScoresResult(institute, specialty, year), 'Ошибка загрузки результатов');
    }

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

    getCompetencySegmentation(filters: CompetencySegmentationFilters) {
        return this.request(() => Api.getCompetencySegmentation(filters), 'Ошибка сегментации компетенций');
    }

    getTopCorrelations(filters: CompetencyCorrelationFilters) {
        return this.request(() => Api.getTopCorrelations(filters), 'Ошибка загрузки корреляций');
    }

    getGeographyReport(year: number | string) {
        return Api.getGeographyReport(year).then(response => {
            if (!response.ok) throw new Error('Ошибка загрузки географического отчета');
            return response.blob();
        });
    }

    getCourses() {
        return this.request(() => Api.getPortraitCourses(), 'Ошибка загрузки курсов');
    }

    getInstitutionDirections(institutionIds: number | string[]) {
        return this.request(() => Api.getPortraitGetInstitutionDirections(institutionIds), 'Ошибка загрузки направлений');
    }

    getFilterOptionsWithCounts(
        sessionId: string,
        institutionIds: number | string[] = [],
        directionIds: number | string[] = [],
        courses: number | string[] = [],
        testAttempts: number | string[] = [],
        competencies: string[] = []
    ) {
        return this.request(
            () => Api.getPortraitGetFilterOptionsWithCounts(sessionId, institutionIds, directionIds, courses, testAttempts, competencies),
            'Ошибка загрузки фильтров'
        );
    }

    postDataseshNew() {
        return this.request(() => Api.postPortraitDataseshNew(), 'Ошибка создания сессии');
    }

    postDataseshExtractData(sessionId: string) {
        return this.request(() => Api.postPortraitDataseshExtractData(sessionId), 'Ошибка загрузки данных');
    }

    postDataseshUpdateFilters(sessionId: string, filters: DataSessionFilter[]) {
        return this.request(() => Api.postPortraitDataseshUpdateFilters(sessionId, filters), 'Ошибка обновления фильтров');
    }

    postDataseshUpdateColumns(sessionId: string, columns: string[] | null) {
        return this.request(() => Api.postPortraitDataseshUpdateColumns(sessionId, columns), 'Ошибка обновления столбцов');
    }

    postDataseshUpdateWindow(sessionId: string, start: number, end: number) {
        return this.request(() => Api.postPortraitDataseshUpdateWindow(sessionId, start, end), 'Ошибка загрузки данных');
    }

    postDataseshExportSelected(sessionId: string, selectedIds: number | string[]) {
        return Api.postPortraitDataseshExportSelected(sessionId, selectedIds).then(response => {
            if (!response.ok) throw new Error('Ошибка экспорта данных');
            return response.blob();
        });
    }

    postDataseshCountStats(sessionId: string) {
        return this.request(() => Api.postPortraitDataseshCountStats(sessionId), 'Ошибка загрузки статистики');
    }

    postDataseshGroupSelected(sessionId: string, selectedIds: number | string[], groupingColumn: string) {
        return this.request(
            () => Api.postPortraitDataseshGroupSelected(sessionId, selectedIds, groupingColumn),
            'Ошибка группировки данных'
        );
    }

    postAiAnalyticsSummary(contextType: string, filters: Record<string, unknown>) {
        return this.request(() => Api.postAiAnalyticsSummary(contextType, filters), 'Ошибка AI-аналитики');
    }

    getAnalyzeTransfers(queryString: string = '') {
        return this.request(() => Api.getAnalyzeTransfers(queryString), 'Ошибка анализа переводов');
    }

    postAnalyzeTransferStudents(body: TransferStudentsInput) {
        return this.request(() => Api.postAnalyzeTransferStudents(body), 'Ошибка анализа студентов');
    }

    getPossibleDuplicateAccounts() {
        return this.request(() => Api.getPossibleDuplicateAccounts(), 'Ошибка загрузки дублей');
    }

    /**
     * VAM студента
     */
    getAnalyzeStudentVam(studentId: number, competency?: string) {
        return this.request(() => Api.getAnalyzeStudentVam(studentId, competency), 'Ошибка анализа VAM');
    }

    /**
     * LGM когорт
     */
    postAnalyzeCohortLgm(
        competency: string,
        institutionIds: number | string[] = [],
        directionIds: number | string[] = [],
        groupBy: LgmGroupBy = 'institution'
    ) {
        return this.request(() => Api.postAnalyzeCohortLgm(competency, institutionIds, directionIds, groupBy), 'Ошибка анализа LGM');
    }

    /**
     * Анализ дисциплин
     */
    getAllDisciplinesImpact() {
        return this.request(() => Api.getAnalyzeAllDisciplinesImpact(), 'Ошибка анализа дисциплин');
    }

    postAnalyzeDisciplineImpactAdvanced(
        competencies: string[],
        disciplines: string[],
        institutionIds: number | string[],
        directionIds: number | string[],
        limit: number
    ) {
        return this.request(
            () => Api.postAnalyzeDisciplineImpactAdvanced(competencies, disciplines, institutionIds, directionIds, limit),
            'Ошибка анализа дисциплин'
        );
    }

    postGetLgmGrowers(
        competency: string,
        groupBy: LgmGroupBy,
        groupId: number | string,
        institutionIds: number | string[] = [],
        directionIds: number | string[] = []
    ) {
        return this.request(
            () => Api.postGetLgmGrowers(competency, groupBy, groupId, institutionIds, directionIds),
            'Ошибка загрузки студентов LGM'
        );
    }

    postGetCompetencyLevelFlow(competency: string, institutionIds: number | string[], directionIds: number | string[]) {
        return this.request(() => Api.postGetCompetencyLevelFlow(competency, institutionIds, directionIds), 'Ошибка анализа уровней');
    }

    postGetCompetencyLevelFlowYearly(competency: string, institutionIds: number | string[], directionIds: number | string[]) {
        return this.request(
            () => Api.postGetCompetencyLevelFlowYearly(competency, institutionIds, directionIds),
            'Ошибка анализа уровней по годам'
        );
    }

    postGetVamTrendData(body: VamTrendInput) {
        return this.request(() => Api.postGetVamTrendData(body), 'Ошибка загрузки динамики VAM');
    }

    postGetBoxplotData(
        competency: string,
        institutionIds: number | string[],
        directionIds: number | string[],
        groupBy: BoxplotGroupBy
    ) {
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
    getDisciplineHeatmapData(institutionIds: number | string[] = [], directionIds: number | string[] = []) {
        return this.request(() => Api.postGetDisciplineHeatmapData(institutionIds, directionIds), 'Ошибка загрузки тепловой карты');
    }

    /**
     * Центры по регионам
     */
    getCentersByRegion(year: number | string) {
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
