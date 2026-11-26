import Api from '../api.js';
import BaseService from './BaseService.js';

class TeacherService extends BaseService {
    getScientificActivity(filters = {}) {
        return this.request(() => Api.getScientificActivity(filters), 'Ошибка загрузки научной деятельности');
    }
    getTeachersTable() {
        return this.request(() => Api.getTeachersTable(), 'Ошибка загрузки таблицы преподавателей');
    }

    getTeacherById(teacherId: number) {
        return this.request(() => Api.getTeacherById(teacherId), 'Ошибка загрузки данных преподавателя');
    }
}
export default new TeacherService();
