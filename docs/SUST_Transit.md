# **SUST Transport Requisition System**

## **Functional Requirements Document**

**Version:** 1.0  
**Date:** 3 September 2026  
**Status:** Consolidated

---

# **1\. Purpose**

The SUST Transport Requisition System manages the complete transport requisition lifecycle, including user registration, requisition submission, recommendation, approval, vehicle and driver management, scheduling, allocation, confirmation, duty slips, trip completion, mileage, notifications, and administrative operations.

---

# **2\. User Roles**

The system shall support the following roles:

* Student  
* Teacher  
* Officer  
* Department Head  
* Transport Administrator  
* Transport in Charge  
* Super Admin  
* Club Account  
* Society Account

Administrative roles are appointed internally.

The system shall use role-based access control.

---

# **3\. Applicant Requirements**

## **3.1 Registration and Verification**

Applicants shall register using an approved SUST institutional email address.

The system shall:

1. Validate the institutional email domain.  
2. Send an OTP to the registered email.  
3. Verify the OTP.  
4. Create the account after successful verification.

OTP verification shall support:

* Pending  
* Verified  
* Expired

Passwords shall be securely hashed.

## **3.2 Registration Information**

All applicants shall provide:

* Full name  
* Mobile number  
* Signature image

Applicant type is determined automatically from the email verification.

### **Students**

Students shall additionally provide:

* Department  
* Student registration number

### **Teachers**

Teachers shall additionally provide:

* Department  
* Designation

### **Officers**

Officers shall additionally provide:

* Office  
* Designation

# **4\. Applicant Profile**

After login, applicants may edit permitted profile information.

Requester information used in a requisition shall be automatically populated from the applicant's account and remain locked.

The following requester information shall be shown:

* Name  
* Mobile number  
* Designation, where applicable  
* Department/Office

---

# **5\. Transport Requisition**

## **5.1 Create Requisition**

Applicants may create transport requisitions.

A requisition shall contain:

* Purpose  
* Start date  
* End date, where applicable  
* Schedule type, where applicable  
* Requested/start/end time  
* Route  
* Ordered stoppage sequence (A single input box)   
* Reason  
* Supporting document, where applicable

The standard journey shall follow:

**Campus → Destination → Campus**

The system shall record requested start and end times and enforce the maximum three-hour vehicle-hold requirement.

## **5.2 Transport User**

The requester may specify a transport user who is different from the requester.

Transport user information shall include:

* Name  
* Designation, optional  
* Mobile number (Mandatory)

## **5.3 Purpose**

Supported purposes are 3 types:

* Personal Use  
* Departmental / Official Use  
* Club

Students,clubs can not select Personal Use.

## **5.4 Multiple Trips**

A requisition may contain multiple trips on different dates.

Each trip shall have:

* One vehicle category  
* One requested time  
* One route

Each trip shall be treated as a separate allocation requirement.

Individual trips may therefore be approved, rejected, or kept pending independently.

## **5.5 Passenger Groups**

This field is optional to fill up.

Passenger groups may be associated with a route or schedule, such as:

* Department Students  
* Contestants  
* Judges and Guests

Passenger groups shall be displayed to administrators and on confirmation slips but shall not determine vehicle allocation.

## **5.6 Drafts**

Applicants may save a requisition as a draft before submission.

---

# **6\. Recommendation**

Recommendation is required according to the following rules:

| Applicant / Purpose | Recommendation |
| ----- | ----- |
| Teacher/Officer — Personal | Not required |
| Teacher/Officer — Official | Department/Office Head |
| Student — Official | Department Head |
| Department/Office Head — Personal | Not required |
| Club \- Club | Teacher |

Where required, the applicant shall select the appropriate recommender.

A recommender may:

* Recommend with a short optional message  
* Reject/Cancel  
* Request additional information  
* Attach digitally signed documents or notes where required

Rejection or return may include a reason.

---

# **7\. Applicant Application Status**

Applicants shall be able to track their requisition status.

Possible states include:

* Draft  
* Pending Recommendation  
* Information Requested  
* Recommended  
* Pending on Transport Office  
* Pending Administrator  
* Partially Approved  
* Approved  
* Rejected  
* Completed(After the approved applications trip occurs)

For multiple-trip applications, each trip may have its own:

* Approved  
* Rejected  
* Pending

status.

Applicants shall be able to see rejection reasons.

---

# **8\. Transport Office**

The Transport Office manages vehicle availability, drivers, scheduling, requisition processing, allocation, approval, duty slips, completion, mileage, and notifications.

The main Transport Office roles are:

* 'Transport In Charge'  
* Transport Administrator  
* Super Admin

---

# **9\. 'Transport In Charge' Operations**

The Transport In Charge can add vehicle, driver, Transport Schedule

The 'Transport In Charge' shall receive applications.

The 'Transport In Charge' may:

* Approve and forward applications to the Transport Administrator after selecting the vehicle.  
* Send applications back with a reason (goes to the applicant. When he sends that application again it goes to the recommender if needed)  
* Reject where permitted  
* A vehicle must be assigned before an application is forwarded to the Transport Administrator.

The assignment shall reserve the corresponding booking slot.

# **11\. Driver Management**

The Transport Office shall maintain a Driver directory containing:

* Name  
* Designation  
* Employment type  
* Contact number  
* Active/Inactive status

Supported driver designations include:

* Senior Driver  
* Driver  
* Driver (Grade-1)  
* Driver (Outsourced)

---

# **12\. Vehicle Management**

The Transport Office shall maintain a centralized vehicle inventory containing:

* Registration number(Unique)  
* Category  
* Fuel type, where applicable  
* Operational status  
* Vehicle User , where applicable  
* Requisition eligibility

Supported vehicle categories:

* Jeep  
* Car  
* Mitsubishi Bus  
* Hino Bus  
* Tata Bus  
* Minibus  
* Minibus A/C  
* Microbus  
* Pickup

Ambulances are outside the requisition system.

Vehicle statuses:

* Active  
* Under Maintenance  
* Out-of-Service

Only Active and requisition-eligible vehicles may be allocated.

Maintenance, out-of-service, and restricted vehicles remain visible but cannot be selected for ordinary requisitions.

Administrators may search/filter vehicles by:

* Registration number  
* Category  
* Status  
* Driver

Passenger capacity shall not be automatically validated.

A vehicle may be deleted unless an active/relevant allocation prevents deletion.

---

# **13\. Driver Assignment**

###  **Driver Information**

Each driver record shall contain:

* Name  
* Designation  
* Employment type  
* Contact number  
* Assigned Vehicle  
* Active/Inactive status

Each vehicle may have zero or one driver.

Each driver may be assigned to at most one vehicle.

A vehicle without an assigned driver shall display:

**No Driver**

The system shall prevent assigning:

* A driver already assigned to another vehicle  
* An inactive driver

When a driver is replaced:

* The new driver becomes assigned.  
* The previous driver becomes unassigned.

During requisition allocation, the administrator selects the vehicle only. The system automatically uses the vehicle's current assigned driver.

A driver cannot be replaced for an individual trip.

If an assigned driver is deactivated, the vehicle automatically becomes **No Driver**, while historical driver information is preserved.

Temporary replacement drivers are not supported.

---

# **15\. Transport Schedule Requirements**

### **FR-38 — Transport Schedule**

The system shall provide a **Transport Schedule** page for managing vehicles regularly used for student transportation according to the university routine.

The page shall replace the previous **Routes** page.

### **FR-39 — Scheduled Vehicles**

The Transport Schedule page shall display vehicles assigned to regular student transportation.

### **FR-40 — Free After Time**

For each scheduled vehicle, the administrator shall be able to specify a **Free After** time.

Example:

| Vehicle Number | Category | Free After |
| ----- | ----- | ----- |
| Sylhet Metro-Gha 11-0012 | Hino Bus | 6:50 PM |
| Sylhet Metro-Gha 11-0015 | Hino Bus | 7:10 PM |
| Sylhet Metro-Gha 11-0021 | Minibus | 5:30 PM |

### **FR-41 — Schedule-Based Availability**

A vehicle assigned to the Transport Schedule shall be unavailable for requisition before its specified **Free After** time.

At or after the Free After time, the vehicle may become available for requisition if no other restriction applies.

The schedule does not need to manage detailed route information.

---

# **16\. Vehicle Off-Day Requirements**

### **FR-42 — Vehicle Off-Day**

The administrator shall be able to mark a vehicle as unavailable for a specific date.

### **FR-43 — Recurring Off-Day**

The system shall support recurring vehicle off-days based on a specified weekday.

### **FR-44 — Off-Day Restriction**

A vehicle marked as unavailable for a date shall automatically be excluded from vehicle selection for requisition allocation.

If a vehicle already has an allocation for that date, the administrator shall not be allowed to mark it as an off-day and the system shall display an appropriate warning.

---

# **18\. Queue**

All eligible requisitions shall appear in a unified allocation queue.

Each request shall identify its type:

* Club  
* Departmental /Official  
* Personal

Requests shall normally be processed according to arrival order.

A departmental/official request requiring Department or Office Head approval shall not enter the allocation queue until approval is granted.

Only applications reaching the appropriate allocation-ready state shall enter the final allocation queue.

---

# **19\. Administrator Approval and Allocation**

The Transport Administrator is the final approval authority.

The Administrator shall approve or reject requested trips independently, allowing partial approval for multi-trip applications.

For each trip, the applicant shall see:

* Approved  
* Rejected  
* Pending

Every rejection shall include:

* Rejection reason

Supported rejection categories:

* Vehicle unavailable  
* Driver unavailable  
* Schedule conflict  
* Other

The rejection information shall be visible to the applicant.

The Administrator may:

* Approve  
* Reject  
* Send the application back to the 'Transport In Charge' with a reason

When an application is sent back, permitted editable information includes:

* Transport user information  
* Journey details  
* Requisition details

Requester information remains locked.

---

# **20\. Confirmation Slip**

Approved applications shall generate a confirmation slip containing:

* Official Transport Office header  
* Trip purpose  
* Approved schedule  
* Passenger groups  
* Vehicle registration  
* Vehicle category  
* Driver name  
* Driver contact  
* Ordered route/stoppage sequence

For partially approved applications, each trip shall show:

* Approved  
* Rejected  
* Pending

Rejected trips shall show the rejection reason.

Applicants shall be able to download the approved requisition slip as a PDF.

---

# **21\. Driver Duty Slip**

The Transport Administrator shall be able to generate duty slips only for approved trips.

A consolidated duty slip may contain multiple assigned days within the same application.

The duty slip shall contain:

* Driver name and designation  
* Vehicle registration and category  
* Reporting location and time  
* Route/stoppage sequence for each assigned day  
* Application reference  
* Trip purpose

If an approved vehicle is reassigned, the previous duty slip shall be marked:

**Superseded — see new slip**

A new duty slip shall then be generated.

---

# **22\. Trip Completion**

The Transport Driver shall mark an assigned trip as **Completed** after the trip takes place.

Completion status and mileage shall be stored separately.

---

# **23\. Mileage**

For approved personal-use Teacher requisitions, authorized Driver/Administrator users shall record the total distance travelled after the vehicle returns to the depot.

Mileage shall contain:

* Distance in kilometers  
* Entry timestamp

The system shall provide an **Awaiting Mileage** list for approved personal-use Teacher/Officer trips without mileage.

Departmental, club, and organization-based applications are excluded from mileage entry.

After mileage is recorded, the requisition becomes:

**Ready for Accounts**

The system shall not store the per-kilometer billing rate. Accounts independently calculates the bill.

Applicants may view lifetime kilometers and per-trip history for completed personal trips.

Per-vehicle kilometer rollups for maintenance are outside the current scope.

---

# **24\. Notifications**

The system shall provide in-app notifications containing:

* Notification type  
* Timestamp  
* Link to the relevant requisition/conflict  
* Read/unread status

Opening a notification marks it as read.

The Administrator shall see an unread notification badge.

Notifications shall cover relevant events including:

* New eligible requisition  
* Registration approval/rejection  
* Recommendation request/decision  
* 'Transport In Charge' actions  
* Final approval/rejection  
* Send-back  
* Account activation/deactivation

Email, SMS, and browser push notifications are not required.

---

# **25\. Historical Records**

The system shall preserve historical:

* Requisitions  
* Allocations  
* Drivers  
* Vehicle assignments  
* Completion records  
* Mileage records

Deactivating users or changing/removing vehicle-driver assignments shall not alter historical records.

Each allocation shall retain a reference to its originating requisition/trip.

---

# **27\. Out of Scope**

The following are excluded from the current version:

1. Driver overtime and detailed shift-clock tracking.  
2. QR-code or verification-hash functionality on slips.  
3. Reporting and data-export functionality.  
4. Ambulance management.  
5. Recommender workflow implementation inside the Administrator module.  
6. Automatic reassignment of in-flight applications when a reviewer is deactivated.  
7. Per-vehicle kilometer rollups for maintenance.  
8. Temporary replacement-driver management.  
9. Per-kilometer billing-rate storage.  
10. Automatic passenger-capacity validation.

