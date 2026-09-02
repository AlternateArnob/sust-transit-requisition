import { useParams } from "react-router-dom";

function VehicleDetailsPage() {
  const { vehicleId } = useParams();

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1E293B]">Vehicle Details</h1>

      <p className="mt-2 text-[#64748B]">Vehicle ID: {vehicleId}</p>
    </div>
  );
}

export default VehicleDetailsPage;
