import { Modal } from "antd";
import { useState, useEffect } from 'react';
import './StudentModal.scss';
import { Button } from "../../../components";
import { useNavigate } from "react-router-dom";

function StudentModal({open, student, onClose}){
	const navigate = useNavigate();
    const redirectToPortrait = () => {
	    navigate('/admin/portrait', { state: { studentId: student.part_id } });
    }
	useEffect(() => {
        if (!open) return;

        const handleClickOutside = event => {
            if (!event.target.closest('.ant-modal-container')) {
                onClose?.();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);
    return (
        <div className="StudentModal">
            <Modal
                open={open}
				centered={true}
				closable={true}
                footer={null}
                onClose={onClose}
				onCancel={onClose}
				title={'Студент'}
            >
                <div className="StudentModal__body">
                    <div className="student__name">
                        { student?.name }
                    </div>
                    <div className="student__name">
                        { student?.institution}
                    </div>
                    <div className="student__name">
                        Курс { student?.res_course_num }
                    </div>
                    <div className="button">
                        <Button text={'Открыть портрет'} onClick={redirectToPortrait}/>
                    </div>
                </div>
            </Modal>

        </div>
    );
}

export default StudentModal;