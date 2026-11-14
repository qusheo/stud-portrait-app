// utilities.js — функции-хелперы. Константы (РСВ, курсы, link tree, поля) живут в src/constants/.

import ExcelJS from 'exceljs';

import { RESULT_PROFILES } from '../constants/rsv.js';

export async function excelReadColumns(data) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(data);
    const headers = {};
    workbook.worksheets.forEach(worksheet => {
        const headerRow = worksheet.getRow(1);
        headers[worksheet.name] = Array.from({ length: headerRow.cellCount }, (_, index) =>
            (headerRow.getCell(index + 1).text || '').trim()
        );
    });
    return headers;
}

export async function excelWriteFile(data, headers) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('SQL_Result');
    worksheet.addRows(data);
    headers.forEach((_, idx) => {
        worksheet.getColumn(idx + 1).width = Math.max(String(headers[idx]).length, 15);
        worksheet.getRow(1).getCell(idx + 1).font = { bold: true };
    });

    await downloadExcelWorkbook(workbook, `query_result_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.xlsx`);
}

export async function downloadExcelWorkbook(workbook, filename) {
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

/** Получить доступные профили на основе данных */
export function getAvailableProfiles(data) {
    if (!data) return [];

    const availableProfiles = [];

    Object.values(RESULT_PROFILES).forEach(profile => {
        const hasData = Object.values(profile.categories).some(category => {
            return category.fields.some(field => data.some(yearData => yearData[field.key] !== null && yearData[field.key] !== undefined));
        });

        if (hasData) {
            availableProfiles.push(profile);
        }
    });

    return availableProfiles;
}

/** Получить доступные категории внутри профиля */
export function getAvailableCategories(data, profileKey) {
    if (!data) return [];

    const profile = RESULT_PROFILES[profileKey];
    if (!profile) return [];

    const availableCategories = [];

    Object.values(profile.categories).forEach(category => {
        const hasData = data.some(yearData => {
            return category.fields.some(field => yearData[field.key] !== null && yearData[field.key] !== undefined);
        });

        if (hasData) {
            availableCategories.push(category);
        }
    });

    return availableCategories;
}

/** Получить данные категории */
export function getCategoryData(data, profileKey, categoryKey) {
    if (!data) return [];

    const profile = RESULT_PROFILES[profileKey];
    if (!profile) return [];

    const category = profile.categories[categoryKey];
    if (!category) return [];

    return category.fields.map(field => {
        const fieldData = {
            label: field.label,
            key: field.key,
            values: []
        };

        data.forEach(yearData => {
            if (yearData[field.key] !== null && yearData[field.key] !== undefined) {
                fieldData.values.push({
                    year: yearData.res_year,
                    value: yearData[field.key]
                });
            }
        });

        return fieldData;
    });
}

/** Подготовить данные для таблицы категории */
export function prepareCategoryTableData(resultsData, profileKey, categoryKey) {
    if (!resultsData?.length) return { tableData: [], years: [] };

    const profile = RESULT_PROFILES[profileKey];
    if (!profile) return { tableData: [], years: [] };

    const category = profile.categories[categoryKey];
    if (!category) return { tableData: [], years: [] };

    const years = [...new Set(resultsData.map(item => item.res_year))].sort();

    const tableData = category.fields.map(field => {
        const row = {
            competency: field.label,
            competencyKey: field.key
        };

        years.forEach(year => {
            const yearData = resultsData.find(item => item.res_year === year);
            const value = yearData?.[field.key] ?? null;
            row[year] = value !== null ? value : '-';
        });

        return row;
    });

    return { tableData, years };
}

/** Получить все доступные годы из данных */
export function getAvailableYears(data) {
    if (!data?.length) return [];
    return [...new Set(data.map(item => item.res_year))].sort((a, b) => b - a); // по убыванию
}

/** Получить данные за конкретный год для категории */
export function getCategoryDataForYear(resultsData, profileKey, categoryKey, year) {
    if (!resultsData?.length) return { labels: [], data: [], year: null };

    const profile = RESULT_PROFILES[profileKey];
    if (!profile) return { labels: [], data: [], year: null };

    const category = profile.categories[categoryKey];
    if (!category) return { labels: [], data: [], year: null };

    const yearData = resultsData.find(item => item.res_year === year);

    if (!yearData) return { labels: [], data: [], year: null };

    const labels = [];
    const data = [];

    category.fields.forEach(field => {
        const value = yearData[field.key];
        if (value !== null && value !== undefined) {
            labels.push(field.label);
            data.push(value);
        }
    });

    return { labels, data, year };
}
