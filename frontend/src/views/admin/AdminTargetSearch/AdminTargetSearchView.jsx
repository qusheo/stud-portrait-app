import './AdminTargetSearchView.scss';
import SearchPanel from './SearchPanel.jsx';
import { useState } from 'react';

function AdminTargetSearchView() {
    function onApply() {}
    return (
        <div>
            <div>Поиск студента</div>
            <SearchPanel onApply={onApply} />
        </div>
    );
}

export default AdminTargetSearchView;
