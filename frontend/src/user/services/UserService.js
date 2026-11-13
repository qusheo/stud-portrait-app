
import Api from '../../api.js';

class UserService {
    async getPermissions() {
        const response = await Api.getUserPermissions();
        const data = await response.json().catch(() => null);

        if (!response.ok) {
            throw new Error(
                data?.message || 'Не удалось загрузить права доступа'
            );
        }

        return data;
    }
}

export default new UserService();
