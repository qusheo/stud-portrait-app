import { MatchingService } from "@services";

function AdminGroupingView() {
    const [isGroupingLoading, setGroupigLoading] = useState(false);

    const getGroup = async () => {
            try {
                setGroupigLoading(true);
                const data = await MatchingService.getMatchGroups();
                rows = data ?? [];
            }
            catch (e) {}
            finally{
                setGroupigLoading(false);
            }
        }
    return;
}

export default AdminGroupingView;
