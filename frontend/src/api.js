class Api {
    constructor() {
        HOST = import.meta.env.VITE_API_URL;
    }

    getAuditSchema(tableName = null) {
        const params = new URLSearchParams();
        if (tableName) params.append('table_name', tableName);
        const url = `${HOST}/portrait/audit/schema/${params.toString() ? `?${params.toString()}` : ''}`;
        const promise = fetch(url);
        return promise;
    }

    getAuditTableData(tableName, limit = 10) {
        const params = new URLSearchParams();
        params.append('table_name', tableName);
        params.append('limit', limit);
        const url = `${HOST}/portrait/audit/table-data/?${params.toString()}`;
        const promise = fetch(url);
        return promise;
    }

    getAuditStats() {
        const url = `${HOST}/portrait/audit/stats/`;
        const promise = fetch(url);
        return promise;
    }

    postAuditExecuteSQL(query) {
        const promise = fetch(`${HOST}/portrait/audit/execute-sql/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query })
        });
        return promise;
    }

    /* *** DATALOAD *** */

    postDataloadImportExcel(file, configJson) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('config_json', JSON.stringify(configJson));
        const promise = fetch(`${HOST}/portrait/dataload/import-excel/`, {
            method: 'POST',
            body: formData
        });
        return promise;
    }

    // Шаблоны загрузки
    getDataloadExpectedFields() {
        const promise = fetch(`${HOST}/portrait/dataload/expected-fields/`);
        return promise;
    }

    getDataloadTemplates() {
        const promise = fetch(`${HOST}/portrait/dataload/templates/`);
        return promise;
    }

    postDataloadTemplateSave(name, config, description = '') {
        const promise = fetch(`${HOST}/portrait/dataload/template-save/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, config, description })
        });
        return promise;
    }

    deleteDataloadTemplateDelete(templateId) {
        const promise = fetch(`${HOST}/portrait/dataload/template-delete/${templateId}/`, {
            method: 'DELETE'
        });
        return promise;
    }

    // *** DATASESH *** */
    postPortraitDataseshNew() {
        const promise = fetch(`${HOST}/portrait/datasesh/new/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        return promise;
    }

    postPortraitDataseshExtractData(sessionId) {
        const promise = fetch(`${HOST}/portrait/datasesh/extract-data/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId })
        });
        return promise;
    }

    postPortraitDataseshUpdateFilters(sessionId, filters) {
        const promise = fetch(`${HOST}/portrait/datasesh/update-filters/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: sessionId,
                filters: filters
            })
        });
        return promise;
    }

    postPortraitDataseshUpdateColumns(sessionId, columns) {
        const promise = fetch(`${HOST}/portrait/datasesh/update-columns/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: sessionId,
                columns: columns
            })
        });
        return promise;
    }

    postPortraitDataseshUpdateWindow(sessionId, start, end) {
        const promise = fetch(`${HOST}/portrait/datasesh/update-window/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: sessionId,
                start: start,
                end: end
            })
        });
        return promise;
    }

    postPortraitDataseshExportSelected(sessionId, selectedIds) {
        const promise = fetch(`${HOST}/portrait/datasesh/export-selected/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: sessionId,
                selected_ids: selectedIds
            })
        });
        return promise;
    }

    postPortraitDataseshGroupSelected(sessionId, selectedIds, grouppingColumn) {
        const promise = fetch(`${HOST}/portrait/group-data/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: sessionId,
                selected_ids: selectedIds,
                groupping_column: grouppingColumn
            })
        });
        return promise;
    }

    postPortraitDataseshCountStats(sessionId) {
        const promise = fetch(`${HOST}/portrait/datasesh/count-stats/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId })
        });
        return promise;
    }

    /* *** statsresult *** */

    getPortraitCourses() {
        const promise = fetch(`${HOST}/portrait/courses/`);
        return promise;
    }

    getPortraitStudentResults(studentId) {
        const params = new URLSearchParams({ stud_id: studentId });
        const promise = fetch(`${HOST}/portrait/student-results/?${params}`);
        return promise;
    }

    getPortraitGetInstitutionDirections(selectedInstitutions) {
        const params = new URLSearchParams();
        selectedInstitutions?.forEach(id => params.append('institution_ids[]', id));
        const promise = fetch(`${HOST}/portrait/get-institution-directions/?${params}`);
        return promise;
    }

    getPortraitGetFilterOptionsWithCounts(
        sessionId,
        selectedInstitutions,
        selectedDirections,
        selectedCourses,
        selectedTestAttempts,
        selectedCompetencies
    ) {
        const params = new URLSearchParams({ session_id: sessionId });
        selectedInstitutions?.forEach(id => params.append('institution_ids[]', id));
        selectedDirections?.forEach(dir => params.append('directions[]', dir));
        selectedCourses?.forEach(course => params.append('courses[]', course));
        selectedTestAttempts?.forEach(attempts => params.append('test_attempts[]', attempts));
        selectedCompetencies?.forEach(comp => params.append('competencies[]', comp));
        const promise = fetch(`${HOST}/portrait/get-filter-options-with-counts/?${params}`);
        return promise;
    }

    getPortraitCentersByRegion(year) {
        const promise = fetch(`${HOST}/portrait/centers-by-region/?year=${encodeURIComponent(year)}`);
        return promise;
    }

    getMotivatorStatistics(filters) {
        const params = new URLSearchParams();
        if (filters.institute) params.append('institute', filters.institute);
        if (filters.specialty) params.append('specialty', filters.specialty);
        if (filters.year) params.append('year', filters.year);
        if (filters.group_by) params.append('group_by', filters.group_by);

        const queryString = params.toString();
        const url = `${HOST}/portrait/motivator-statistics/${queryString ? `?${queryString}` : ''}`;

        const promise = fetch(url);
        return promise;
    }

    /* ============================================================ */
    /*                    АНАЛИТИЧЕСКИЕ ENDPOINTS                   */
    /* ============================================================ */

    /** GET /portrait/analyze-student-vam/ - VAM для конкретного студента */
    getAnalyzeStudentVam(studentId, competency = 'res_comp_leadership') {
        const params = new URLSearchParams({ student_id: studentId, competency });
        const promise = fetch(`${HOST}/portrait/analyze-student-vam/?${params}`);
        return promise;
    }

    /** POST /portrait/analyze-cohort-lgm/ - LGM для когорты */
    postAnalyzeCohortLgm(competency, institutionIds = [], directionIds = [], groupBy = 'institution') {
        const promise = fetch(`${HOST}/portrait/analyze-cohort-lgm/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                competency,
                institution_ids: institutionIds,
                direction_ids: directionIds,
                group_by: groupBy
            })
        });
        return promise;
    }

    /** POST /portrait/get-lgm-growers/ - Списки быстро- и медленнорастущих студентов для группы */
    postGetLgmGrowers(competency, groupBy, groupId, institutionIds = [], directionIds = []) {
        const promise = fetch(`${HOST}/portrait/get-lgm-growers/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                competency,
                group_by: groupBy,
                group_id: groupId,
                institution_ids: institutionIds,
                direction_ids: directionIds
            })
        });
        return promise;
    }

    /** GET /portrait/analyze-all-disciplines-impact/ - Комплексный анализ всех дисциплин */
    getAnalyzeAllDisciplinesImpact() {
        const promise = fetch(`${HOST}/portrait/analyze-all-disciplines-impact/`);
        return promise;
    }

    /** POST /portrait/analyze-discipline-impact-advanced/ - Продвинутый анализ с фильтрами */
    postAnalyzeDisciplineImpactAdvanced(
        competencies = ['res_comp_leadership'],
        disciplines = [],
        institutionIds = [],
        directionIds = [],
        minStudents = 5
    ) {
        const promise = fetch(`${HOST}/portrait/analyze-discipline-impact-advanced/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                competencies,
                disciplines,
                institution_ids: institutionIds,
                direction_ids: directionIds,
                min_students: minStudents
            })
        });
        return promise;
    }

    /** POST /portrait/get-discipline-heatmap-data/ - Тепловая карта */
    postGetDisciplineHeatmapData(institutionIds = [], directionIds = []) {
        const promise = fetch(`${HOST}/portrait/get-discipline-heatmap-data/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                institution_ids: institutionIds,
                direction_ids: directionIds
            })
        });
        return promise;
    }

    /** GET /portrait/get-disciplines/ - список всех дисциплин */
    getPortraitGetDisciplines() {
        const promise = fetch(`${HOST}/portrait/get-disciplines/`);
        return promise;
    }

    /** GET /portrait/analyze-student-discipline-impact/ - влияние дисциплин на студента */
    getStudentDisciplineImpact(studentId) {
        const params = new URLSearchParams({ student_id: studentId });
        const promise = fetch(`${HOST}/portrait/analyze-student-discipline-impact/?${params}`);
        return promise;
    }

    postGetCompetencyLevelFlow(competency, institutionIds, directionIds) {
        const promise = fetch(`${HOST}/portrait/get-competency-level-flow/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                competency,
                institution_ids: institutionIds,
                direction_ids: directionIds
            })
        });
        return promise;
    }

    postGetCompetencyLevelFlowYearly(competency, institutionIds, directionIds) {
        const promise = fetch(`${HOST}/portrait/get-competency-level-flow-yearly/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                competency,
                institution_ids: institutionIds,
                direction_ids: directionIds
            })
        });
        return promise;
    }

    postGetVamTrendData(body) {
        const promise = fetch(`${HOST}/portrait/get-vam-trend-data/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        return promise;
    }

    postAiAnalyticsSummary(contextType, filters) {
        const promise = fetch(`${HOST}/portrait/ai-analytics-summary/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                context_type: contextType,
                filters: filters
            })
        });
        return promise;
    }

    getEducationProfilesComparison(filters) {
        const params = new URLSearchParams();
        if (filters.specialties && filters.specialties.length) {
            params.append('specialties', filters.specialties.join(','));
        }
        if (filters.year) params.append('year', filters.year);
        if (filters.include_motivators !== undefined) {
            params.append('include_motivators', filters.include_motivators);
        }
        if (filters.include_values !== undefined) {
            params.append('include_values', filters.include_values);
        }

        const url = `${HOST}/portrait/education-profiles-comparison/${params.toString() ? `?${params.toString()}` : ''}`;
        const promise = fetch(url);
        return promise;
    }

    /** GET /portrait/analyze-transfers/ - сводный анализ переводов */
    getAnalyzeTransfers(queryString = '') {
        const promise = fetch(`${HOST}/portrait/analyze-transfers/${queryString ? '?' + queryString : ''}`);
        return promise;
    }

    /** POST /portrait/analyze-transfer-students/ - детальный список студентов с переводами */
    postAnalyzeTransferStudents(body) {
        const promise = fetch(`${HOST}/portrait/analyze-transfer-students/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        return promise;
    }

    /** GET /portrait/get-institutions/ - список вузов */
    getInstitutions() {
        const promise = fetch(`${HOST}/portrait/get-institutions/`);
        return promise;
    }

    getStudentComparisonStats(studentId, year) {
        const params = new URLSearchParams();
        params.append('student_id', studentId);
        if (year) params.append('year', year);

        const url = `${HOST}/portrait/student-comparison-stats/?${params.toString()}`;
        const promise = fetch(url);
        return promise;
    }

    getFilterOptions(institute) {
        const params = new URLSearchParams();
        if (institute) params.append('institute', institute);
        const promise = fetch(`${HOST}/portrait/Filter-options/?${params}`);
        return promise;
    }

    getScoresResult(institute, specialty, year) {
        const params = new URLSearchParams();
        if (institute) params.append('institute', institute);
        if (specialty) params.append('specialty', specialty);
        if (year) params.append('year', year);
        const promise = fetch(`${HOST}/portrait/scores-result/?${params}`);
        return promise;
    }

    getDataBoxplot(institute, specialty, year) {
        const params = new URLSearchParams();
        if (institute) params.append('institute', institute);
        if (specialty) params.append('specialty', specialty);
        if (year) params.append('year', year);
        const promise = fetch(`${HOST}/portrait/comp-boxplot/?${params}`);
        return promise;
    }

    getDashboardStats(institute, specialty, year) {
        const params = new URLSearchParams();
        if (institute) params.append('institute', institute);
        if (specialty) params.append('specialty', specialty);
        if (year) params.append('year', year);
        const promise = fetch(`${HOST}/portrait/dashboard-stats/?${params}`);
        return promise;
    }

    getMotivationCounts(institute, specialty, year) {
        const params = new URLSearchParams();
        if (institute) params.append('institute', institute);
        if (specialty) params.append('specialty', specialty);
        if (year) params.append('year', year);
        const promise = fetch(`${HOST}/portrait/motivation-counts/?${params}`);
        return promise;
    }

    postGetBoxplotData(competency, institutionIds = [], directionIds = [], groupBy = 'auto') {
        const promise = fetch(`${HOST}/portrait/get-boxplot-data/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                competency,
                institution_ids: institutionIds,
                direction_ids: directionIds,
                group_by: groupBy
            })
        });
        return promise;
    }

    // Цифровой портрет студента
    getGradesCompetencyCorrelation(institute, specialty, year, discipline, competency) {
        const params = new URLSearchParams();
        if (institute) params.append('institute', institute);
        if (specialty) params.append('specialty', specialty);
        if (year) params.append('year', year);
        if (discipline) params.append('discipline', discipline);
        if (competency) params.append('competency', competency);
        const promise = fetch(`${HOST}/portrait/grades-competency-correlation/?${params}`);
        return promise;
    }

    getCompetencyTrendByYear(institute, specialty) {
        const params = new URLSearchParams();
        if (institute) params.append('institute', institute);
        if (specialty) params.append('specialty', specialty);
        const promise = fetch(`${HOST}/portrait/competency-trend-by-year/?${params}`);
        return promise;
    }

    getTopCorrelations({ topN = 20, sortBy = 'abs', minN = 30, institute = null, specialty = null, year = null } = {}) {
        const params = new URLSearchParams();
        params.append('top_n', topN);
        params.append('sort_by', sortBy);
        params.append('min_n', minN);
        if (institute) params.append('institute', institute);
        if (specialty) params.append('specialty', specialty);
        if (year) params.append('year', year);

        const promise = fetch(`${HOST}/portrait/top-correlations/?${params}`);
        return promise;
    }

    getCompetencySegmentation({ competency, institute = null, specialty = null, year = null, motivatorThreshold = 600 } = {}) {
        const params = new URLSearchParams();
        params.append('competency', competency);
        params.append('motivator_threshold', motivatorThreshold);
        if (institute) params.append('institute', institute);
        if (specialty) params.append('specialty', specialty);
        if (year) params.append('year', year);

        const promise = fetch(`${HOST}/portrait/competency-segmentation/?${params}`);
        return promise;
    }

    getStudentsList(search = '', limit = 50) {
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        params.append('limit', limit);
        const url = `${HOST}/portrait/students/list/?${params.toString()}`;
        const promise = fetch(url);
        return promise;
    }

    getStudentPortrait(studentId) {
        const url = `${HOST}/portrait/students/portrait/?student_id=${studentId}`;
        const promise = fetch(url);
        return promise;
    }

    /* *** GENDOX *** */

    getStudentResumeData(studentId, year) {
        const params = new URLSearchParams();
        params.append('student_id', studentId);
        params.append('year', year);
        params.append('with_ai', 'true');
        const promise = fetch(`${HOST}/portrait/gendox/student-resume-data/?${params}`);
        return promise;
    }

    windowGenerateDocxResume(studentId) {
        const params = new URLSearchParams();
        params.append('student_id', studentId);
        return new WindowChain(`${HOST}/portrait/gendox/generate-resume-docx/?${params}`);
    }

    // Генерация отчёта по географии
    getGeographyReport(year) {
        const url = `${HOST}/portrait/gendox/geography-report/?year=${encodeURIComponent(year)}`;
        const promise = fetch(url);
        return promise;
    }

    /* *** DUPLICATE ACCOUNTS *** */

    getDuplicateAccounts() {
        const promise = fetch(`${HOST}/portrait/duplicate-accounts/`);
        return promise;
    }

    getPossibleDuplicateAccounts() {
        const promise = fetch(`${HOST}/portrait/possible-duplicate-accounts/`);
        return promise;
    }
}
export default Api;
