import Api from '../api.js';
import BaseService from './BaseService.js';

export interface MatchingStudentsInput {
    studentId: number;
    sameGroup?: boolean;
    course?: number;
    motivators?: boolean;
    competences?: boolean;
    values?: boolean;
    amount?: number;
}

class MatchingService extends BaseService {
    getMatchingTeachersByStudent(studentId: number) {
        return this.request(() => Api.getMatchingTeachersByStudent(studentId), 'Ошибка подбора преподавателей для студента');
    }

    getMatchGroups(specialty?: number | string, university?: number | string, course?: number) {
        return this.request(() => Api.getMatchGroups(specialty, university, course), 'Ошибка подбора учебных команд');
    }

    /**
     * Подбирает студентов по выбранным фильтрам сходства.
     */
    getMatchingStudents(input: MatchingStudentsInput) {
        return this.request(() => Api.getMatchingStudents(input), 'Ошибка подбора студентов');
    }
}
export default new MatchingService();
