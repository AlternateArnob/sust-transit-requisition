import { useParams } from "react-router-dom";
import PageTitle from "../components/ui/PageTitle";

function VehicleDetailsPage() {
  const { vehicleId } = useParams();

  return (
    <PageTitle title="Vehicle Details" subtitle={<>Vehicle ID: {vehicleId}</>} />
  );
}

export default VehicleDetailsPage;
