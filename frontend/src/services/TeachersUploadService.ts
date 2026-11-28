import Api from '../api.js';
import BaseService from './BaseService.js';

class TeachersUploadService extends BaseService {
    uploadTeachers(file: File) {
        return this.request(() => Api.postUploadTeachers(file), 'Ошибка загрузки преподавателей');
    }
}
export default new TeachersUploadService();
