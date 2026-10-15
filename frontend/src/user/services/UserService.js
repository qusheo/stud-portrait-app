import Api from '../../api.js';
import BaseService from '../../services/BaseService.js';

class UserService extends BaseService {
    getPermissions() {
        return;// this.request(() => Api.getUserPermissions(), 'Ошибка загрузки прав доступа');
    }
}

export default new UserService();
