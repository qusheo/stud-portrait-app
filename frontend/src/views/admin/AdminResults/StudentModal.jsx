import { Modal } from "antd";
import { useState, useEffect } from 'react';
import './StudentModal.scss';
import { Button } from "../../../components";

function StudentModal(open, student, onClose){

    const redirectToPortrait = () => {
        
    }

    return (
        <div className="StudentModal">
            <Modal
                visible={open}
                footer={null}
                afterClose={onClose}
            >
                <div className="StudentModal__body">
                    <div className="student__name">
                        { student.name }
                    </div>


                    <div className="button">
                        <Button text={''} onClick={redirectToPortrait}/>
                    </div>
                </div>
            </Modal>

        </div>
    );
}

export default StudentModal;