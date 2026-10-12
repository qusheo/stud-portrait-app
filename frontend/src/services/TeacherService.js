import Api from '../api.js';
import BaseService from './BaseService';

class TeacherService extends BaseService {
    getTeachersTable() {
        return this.request(() => Api.getTeachersTable(), 'Ошибка загрузки таблицы преподавателей');
    }

    getTeacherById(teacherId) {
        return this.request(() => Api.getTeacherById(teacherId), 'Ошибка загрузки преподавателя');
    }
}
export default new TeacherService();
