import Api from '../api.js';
import BaseService from './BaseService.js';

class RsvResultsUploadService extends BaseService {
    uploadRsvResults(file: File) {
        return this.request(() => Api.postUploadRsvResults(file), 'Ошибка загрузки результатов РСВ');
    }
}
export default new RsvResultsUploadService();
