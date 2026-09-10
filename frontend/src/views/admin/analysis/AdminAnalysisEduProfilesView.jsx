import EduProfilesComparison from '../../../components/EduProfilesComparison';
import { SidebarLayout, LAYOUT_STYLE, Header, Sidebar, Content } from '../../../components/SidebarLayout';
import { LINK_TREE } from '../../../utilities';

import './AdminAnalysisEduProfilesView.scss';

function AdminAnalysisEduProfilesView() {
    return (
        <div className="AdminAnalysisEduProfilesView">
                    <h2>Сравнение областей образования</h2>
                    <p className="description">
                        Сравнение усреднённых профилей студентов по направлениям подготовки. Анализ различий в мотивационных профилях и
                        ценностях.
                    </p>
                    <EduProfilesComparison />
        </div>
    );
}

export default AdminAnalysisEduProfilesView;
