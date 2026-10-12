import Api from '../api.js';
import BaseService from './BaseService';

class MatchingService extends BaseService {
    getMatchingTeachersByStudent(studentId) {
        return this.request(
            () => Api.getMatchingTeachersByStudent(studentId),
            'Ошибка подбора преподавателей для студента'
        );
    }

    getMatchGroups(specialty, university, course) {
        return this.request(
            () => Api.getMatchGroups(specialty, university, course),
            'Ошибка подбора учебных команд'
        );
    }

    getMatchingStudents(studentId, amount = 1) {
        return this.request(
            () => Api.getMatchingStudents(studentId, amount),
            'Ошибка подбора студентов'
        );
    }
}
export default new MatchingService();