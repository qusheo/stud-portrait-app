import { useState } from 'react';
import { Select } from 'antd';

import GradesUploadService from '@services/GradesUploadService';
import RsvResultsUploadService from '@services/RsvResultsUploadService';
import TeachersUploadService from '@services/TeachersUploadService';

import FlexRow from '@components/FlexRow';
import LabelledBox from '@components/LabelledBox';
import Button from '@components/ui/Button';
import FileInput from '@components/ui/FileInput';
import { ADMIN_PALETTE } from '@components/ui/palette';

import './UploadView.scss';

const UPLOAD_TYPES = [
    {
        value: 'rsv',
        label: 'Результаты РСВ-тестирования',
        service: RsvResultsUploadService,
        upload: file => RsvResultsUploadService.uploadRsvResults(file)
    },
    {
        value: 'grades',
        label: 'Оценки успеваемости',
        service: GradesUploadService,
        upload: file => GradesUploadService.uploadGrades(file)
    },
    {
        value: 'teachers',
        label: 'Преподаватели',
        service: TeachersUploadService,
        upload: file => TeachersUploadService.uploadTeachers(file)
    }
];

function formatResult(result) {
    const parts = [];
    if (result.created !== undefined) parts.push(`создано: ${result.created}`);
    if (result.updated !== undefined) parts.push(`обновлено: ${result.updated}`);
    if (result.mapped !== undefined) parts.push(`связей ФИО→ID: ${result.mapped}`);
    if (result.participants_created !== undefined) parts.push(`новых участников: ${result.participants_created}`);
    if (result.skipped) parts.push(`пропущено: ${result.skipped}`);
    return parts.join(', ');
}

function UploadView() {
    const [uploadType, setUploadType] = useState('rsv');
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState(null);
    const [error, setError] = useState(null);

    const currentType = UPLOAD_TYPES.find(type => type.value === uploadType);

    const handleFileChange = files => {
        setSelectedFile(files[0] ?? null);
        setError(null);
        setUploadResult(null);
    };

    const handleUpload = () => {
        if (!selectedFile || !currentType) return;
        setUploading(true);
        setError(null);

        currentType
            .upload(selectedFile)
            .then(result => {
                setUploadResult(result);
                setSelectedFile(null);
                const fileInput = document.getElementById('upload-excel-file');
                if (fileInput) fileInput.value = '';
            })
            .catch(() => {})
            .finally(() => setUploading(false));
    };

    return (
        <div className="UploadView">
            <h2>Загрузка данных «Россия — страна возможностей»</h2>

            <FlexRow>
                <LabelledBox label="Тип данных">
                    <Select
                        className="upload-type-select"
                        value={uploadType}
                        onChange={value => {
                            setUploadType(value);
                            setSelectedFile(null);
                            setUploadResult(null);
                            setError(null);
                        }}
                        options={UPLOAD_TYPES.map(type => ({ value: type.value, label: type.label }))}
                    />
                </LabelledBox>

                <LabelledBox label="Выбор файла">
                    <FileInput
                        id="upload-excel-file"
                        accept=".xlsx, .xls"
                        onChange={handleFileChange}
                        disabled={uploading}
                        palette={ADMIN_PALETTE.GRAY}
                    />
                </LabelledBox>

                <Button
                    text={uploading ? 'Загрузка...' : 'Загрузить файл'}
                    onClick={handleUpload}
                    disabled={uploading || !selectedFile}
                    palette={ADMIN_PALETTE.GREEN}
                />
            </FlexRow>

            {uploadResult && <div className="success-banner">✅ Загрузка завершена: {formatResult(uploadResult)}</div>}
            {error && <div className="error-banner">{error}</div>}
        </div>
    );
}

export default UploadView;
