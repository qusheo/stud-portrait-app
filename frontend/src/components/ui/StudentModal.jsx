function linkToPortrait(id) {}

function StudentModal(id) {
    const onClick = () => navigate('/admin/student', { state: id });
}

export default StudentModal;
