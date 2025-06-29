import doctorModel from "../model/doctorModel.js"
import bcrytp from 'bcrypt'
import jwt from 'jsonwebtoken'
import appointmentModel from "../model/appointmentModel.js"


const changeAvailablity = async (req, res) => {
    try {
        const { docId } = req.body

        const docData = await doctorModel.findById(docId)
        await doctorModel.findByIdAndUpdate(docId, { available: !docData.available })
        res.json({ success: true, message: 'Availability changed' })


    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

const doctorList = async (req, res) => {

    try {
        const doctors = await doctorModel.find({}).select(['-password', '-email'])
        res.json({ success: true, doctors })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })

    }
}

const doctorLogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        const doctor = await doctorModel.findOne({ email })

        if (!doctor) {
            return res.json({ success: false, message: 'Invalid Credentials' })
        }

        const isMatch = await bcrytp.compare(password, doctor.password)

        if (isMatch) {
            const token = jwt.sign({ id: doctor._id }, process.env.JWT_SECRET)
            res.json({ success: true, token })
        } else {
            res.json({ success: false, message: 'Invalid Credentials' })
        }
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// api to get doctor appointments for doctor panel

const appointmentsDoctor = async (req, res) => {
    try {
        const { docId } = req.body
        const appointments = await appointmentModel.find({ docId })

        res.json({ success: true, appointments })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })

    }
}

// api to make appointment conformation for doctor panel

const appointmentComplete = async (req, res) => {

    try {
        const { docId, appointmentId } = req.body
        const appointmentData = await appointmentModel.findById(appointmentId)

        if (appointmentData && appointmentData.docId === docId) {
            await appointmentModel.findByIdAndUpdate(appointmentId, { isCompleted: true })
            return res.json({ success: true, message: 'Appointment Completed' })
        } else {
            return res.json({ success: false, message: 'Mark failed' })
        }
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}


// api to make appointment cancel for doctor panel

const appointmentCancel = async (req, res) => {

    try {
        const { docId, appointmentId } = req.body
        const appointmentData = await appointmentModel.findById(appointmentId)

        if (appointmentData && appointmentData.docId === docId) {
            await appointmentModel.findByIdAndUpdate(appointmentId, { cancelled: true })
            return res.json({ success: true, message: 'Appointment Cancelled' })
        } else {
            return res.json({ success: false, message: 'Cancellation failed' })
        }
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

//API to get dashboard data for doctor panel

const doctorDashboard = async (req, res) => {
    try {

        const { docId } = req.body

        const appointments = await appointmentModel.find({ docId })

        let earnings = 0

        appointments.map((item) => {
            if (item.isCompleted || item.payment) {
                earnings += item.amount
            }
        })

        let patient = []

        appointments.map((item) => {
            if (!patient.includes(item.userId)) {
                patient.push(item.userId)
            }
        })

        const dashData = {
            earnings,
            appointments: appointments.length,
            patient: patient.length,
            latestAppointments: appointments.reverse().slice(0, 5)
        }
        res.json({ success: true, dashData })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })

    }
}

//API to get doctor profile

const doctorProfile = async (req, res) => {
    try {
        const { docId } = req.body
        const profileData = await doctorModel.findById(docId).select("-password")
        res.json({ success: true, profileData })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })

    }
}

//API to update doctor profile

const updateDoctorProfile = async (req, res) => {
    try {
        const { docId, fees, address, available } = req.body

        await doctorModel.findByIdAndUpdate(docId, { fees, address, available })

        res.json({ success: true, message: 'Profile Updated' })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

export {
    changeAvailablity, doctorList, doctorLogin, appointmentsDoctor,
    appointmentComplete, appointmentCancel, doctorDashboard,
    doctorProfile, updateDoctorProfile
}