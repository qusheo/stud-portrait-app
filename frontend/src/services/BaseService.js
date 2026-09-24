import { toast } from 'react-toastify';

class BaseService {
    async request(apiCall, errorMessage = 'Ошибка загрузки данных') {
        try {
            const response = await apiCall();
            const data = await response.json().catch(() => null);

            if (!data || data.status === 'error') {
                throw new Error(data?.message || errorMessage);
            }
            return data;
        } catch (err) {
            console.error(errorMessage, err);
            toast.error(err.message || errorMessage);
            throw err;
        }
    }
}

export default BaseService;
