import Api from '../api.js';
import BaseService from './BaseService.js';

class GradesUploadService extends BaseService {
    uploadGrades(file: File) {
        return this.request(() => Api.postUploadGrades(file), 'Ошибка загрузки оценок');
    }
}
export default new GradesUploadService();
