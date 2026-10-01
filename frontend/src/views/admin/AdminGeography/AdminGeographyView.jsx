import { useCallback, useEffect, useState } from 'react';

import { AdminService } from '@services';
import { LINK_TREE } from '@utils/utilities';

import { ToastContainer, toast } from 'react-toastify';
import { Content, Header, LAYOUT_STYLE, Sidebar, SidebarLayout } from '@components/SidebarLayout';
import FlexRow from '@components/FlexRow';

import TitledCard from '@components/cards/TitledCard';
import ValueCard from '@components/cards/ValueCard';

import RussianFederationMap from '@components/charts/RussianFederationMap';

import Slider from '@components/ui/Slider';

import Button from '@components/ui/Button';
import { ADMIN_PALETTE } from '@components/ui/palette';

import './AdminGeographyView.scss';

function AdminGeographyView() {
    const YEARS = ['2021/2022', '2022/2023', '2023/2024', '2024/2025', '2025/2026'];

    const [selectedYear, setSelectedYear] = useState('2024/2025');
    const [regionData, setRegionData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [reportLoading, setReportLoading] = useState(false);
    const [maxValue, setMaxValue] = useState(0);
    const [totalCenters, setTotalCenters] = useState(0);
    const [selectedRegion, setSelectedRegion] = useState(null);

    // Загрузка данных при изменении года
    const loadCentersData = useCallback(async year => {
        setLoading(true);

        AdminService.getCentersByRegion(year)
            .then(data => {
                setRegionData(data.data);
                setMaxValue(data.max_value);
                setTotalCenters(data.total_centers);
            })
            .catch(error => {
                console.error('Ошибка API:', error);
                toast.error('Ошибка при загрузке данных');
                setRegionData([]);
            })
            .finally(() => setLoading(false));
    }, []);

    // Обработчик изменения года
    const handleYearChange = year => {
        setSelectedYear(year);
        setSelectedRegion(null); // Сбрасываем выбранный регион при смене года
        loadCentersData(year);
    };

    // Обработчик клика по региону
    const handleRegionClick = region => {
        setSelectedRegion(region);
        toast.success('Выбран регион:', region);
    };

    // Генерация отчёта
    const generateReport = async () => {
        setReportLoading(true);
        AdminService.getGeographyReport(selectedYear)
            .then(blob => {
                // Создаём ссылку для скачивания
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `geography_report_${selectedYear}.docx`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
                toast.success('Отчет создан');
            })
            .catch(error => {
                console.error('Ошибка генерации отчёта:', error);
                toast.error('Ошибка при генерации отчёта');
            })
            .finally(() => setReportLoading(false));
    };

    // Загрузка начальных данных
    useEffect(() => {
        loadCentersData(selectedYear);
    }, []); // Пустой массив зависимостей - загрузка только при монтировании

    return (
        <div className="AdminGeographyView">
            <div className="page-header">
                <h2>География тестирования</h2>
                <Button
                    text={reportLoading ? 'Формирование отчёта...' : '📊 Выгрузить отчёт DOCX'}
                    onClick={generateReport}
                    disabled={reportLoading || loading}
                    palette={ADMIN_PALETTE.GREEN}
                />
            </div>

            <Slider
                values={YEARS}
                initValue={selectedYear}
                onChange={handleYearChange}
                label="Учебный год"
                disabled={loading}
            />

            <div style={{ padding: '10px', display: 'flex', gap: '10px' }}>
                <ValueCard
                    value={totalCenters}
                    text="Всего центров"
                />
                <ValueCard
                    value={regionData?.length || 0}
                    text="Регионов с центрами"
                />
            </div>

            <TitledCard title="Прохождение тестирования в РФ">
                <RussianFederationMap
                    regionData={regionData}
                    max={maxValue || 10}
                    min={0}
                    loading={loading}
                    onRegionClick={handleRegionClick}
                    highlightedRegion="Тюменская область"
                    title={`Центры компетенций ${selectedYear}`}
                />
            </TitledCard>
            <ToastContainer
                position="bottom-right"
                autoClose={2000}
                hideProgressBar={true}
                newestOnTop={false}
                closeOnClick={true}
                rtl={false}
                theme="light"
            />
        </div>
    );
}

export default AdminGeographyView;
