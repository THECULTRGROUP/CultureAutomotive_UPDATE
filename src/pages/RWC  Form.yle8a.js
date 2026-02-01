import wixData from 'wix-data';
import wixLocation from 'wix-location';

$w.onReady(() => {
  // Hide confirmation and conditional fields on load
  $w("#confirmationMessage").hide();
  $w("#modificationDetails").collapse();
  $w("#inspectionHistoryInput").collapse();

  // Conditional logic for form field visibility
  $w("#isModifiedInput").onChange(() => {
    if ($w("#isModifiedInput").value === "Yes") {
      $w("#modificationDetails").expand();
    } else {
      $w("#modificationDetails").collapse();
    }
  });

  $w("#firstInspectionInput").onChange(() => {
    if ($w("#firstInspectionInput").value === "No") {
      $w("#inspectionHistoryInput").expand();
    } else {
      $w("#inspectionHistoryInput").collapse();
    }
  });

  // Handle form submission
  $w("#submitButton").onClick(async () => {
    // Validate required fields
    if (
      !$w("#firstNameInput").value ||
      !$w("#emailInput").value ||
      !$w("#preferredDateInput").value ||
      !$w("#policyAgreement").checked
    ) {
      console.log("Please complete all required fields.");
      return;
    }

    const booking = {
      firstName: $w("#firstNameInput").value,
      lastName: $w("#lastNameInput").value,
      email: $w("#emailInput").value,
      phone: $w("#phoneInput").value,
      contactMethod: $w("#contactMethodInput").value,
      year: $w("#yearInput").value,
      make: $w("#makeInput").value,
      model: $w("#modelInput").value,
      notes: $w("#notesInput").value,
      isModified: $w("#isModifiedInput").value,
      modificationDetails: $w("#modificationDetails").value,
      firstInspection: $w("#firstInspectionInput").value,
      inspectionHistory: $w("#inspectionHistoryInput").value,
      preferredDate: $w("#preferredDateInput").value,
      priorityPass: $w("#priorityPassInput").value
    };

    try {
      await wixData.insert("bookings", booking);

      // Show confirmation and hide form
      $w("#formContainer").collapse();
      $w("#confirmationMessage").expand();

      // If Priority Pass selected, show payment link
      if (
        $w("#priorityPassInput").value &&
        $w("#priorityPassInput").value.toLowerCase().includes("yes")
      ) {
        $w("#priorityPassPayLink").show();
      }

    } catch (err) {
      console.error("Submission error:", err);
    }
  });
});
