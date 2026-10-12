import Api from '../api.js';
import BaseService from './BaseService';

class TeacherService extends BaseService {
    getTeachers(search = '', limit = 100) {
        return this.request(
            () => Api.getTeachers(search, limit),
            'Ошибка загрузки данных преподавателей'
        );
    }

    getTeacherDetail(teacherId) {
        return this.request(
            () => Api.getTeacherDetail(teacherId),
            'Ошибка загрузки карточки преподавателя'
        );
    }

    parseTeachers(sourceUrls = [], includeLms = true) {
        return this.request(
            () => Api.postParseTeachers(sourceUrls, includeLms),
            'Ошибка запуска парсинга преподавателей'
        );
    }

    getParseTeachersLog() {
        return this.request(
            () => Api.getParseTeachersLog(),
            'Ошибка загрузки лога парсинга преподавателей'
        );
    }

    getTeachersTable() {
        return this.request(() => Api.getTeachersTable(), 'Ошибка загрузки таблицы преподавателей');
    }
}
export default new TeacherService();
