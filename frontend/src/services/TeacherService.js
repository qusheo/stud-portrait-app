import Api from '../api.js';
import BaseService from './BaseService';

class TeacherService extends BaseService {
    getTeachersTable() {
        return this.request(() => Api.getTeachersTable(), 'Ошибка загрузки таблицы преподавателей');
    }
}
export default new TeacherService();
