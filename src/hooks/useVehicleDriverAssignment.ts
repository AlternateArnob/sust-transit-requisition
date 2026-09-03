import useVehicles from "./useVehicles";
import useDriver from "./useDriver";

export default function useVehicleDriverAssignment() {
  const { vehicles, updateVehicle } = useVehicles();
  const { driver, updateDriver } = useDriver();

  function assignDriver(vehicleId: string, driverId?: string) {
    const vehicle = vehicles.find((item) => item.id === vehicleId);

    if (!vehicle) {
      return {
        success: false,
        message: "Vehicle not found.",
      };
    }

    // 1. Remove driver path
    if (!driverId) {
      if (vehicle.permanentDriverId) {
        const previousDriver = driver.find(
          (item) => item.id === vehicle.permanentDriverId,
        );

        if (previousDriver) {
          updateDriver({
            ...previousDriver,
            permanentVehicleId: undefined,
          });
        }
      }

      updateVehicle({
        ...vehicle,
        permanentDriverId: undefined,
      });

      return {
        success: true,
        message: "Driver removed from vehicle.",
      };
    }

    // 2. Validate target driver before performing any state mutations
    const targetDriver = driver.find((item) => item.id === driverId);

    if (!targetDriver) {
      return {
        success: false,
        message: "Driver not found.",
      };
    }

    if (targetDriver.status !== "Active") {
      return {
        success: false,
        message: "Inactive drivers cannot be assigned.",
      };
    }

    if (driver.permanentVehicleId && driver.permanentVehicleId !== vehicleId) {
      return {
        success: false,
        message: "This driver is already assigned to another vehicle.",
      };
    }

    // 3. Safe mutation step: unassign previous driver only after target passes validation
    if (vehicle.permanentDriverId && vehicle.permanentDriverId !== driverId) {
      const previousDriver = driver.find(
        (item) => item.id === vehicle.permanentDriverId,
      );

      if (previousDriver) {
        updateDriver({
          ...previousDriver,
          permanentVehicleId: undefined,
        });
      }
    }

    // 4. Finalize bi-directional assignment
    updateVehicle({
      ...vehicle,
      permanentDriverId: driverId,
    });

    updateDriver({
      ...driver,
      permanentVehicleId: vehicleId,
    });

    return {
      success: true,
      message: "Driver assigned successfully.",
    };
  }

  return {
    assignDriver,
  };
}
