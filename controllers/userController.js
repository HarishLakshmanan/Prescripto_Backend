import validator from 'validator'
import bcrypt from 'bcrypt'
import userModel from '../model/userModel.js'
import jwt from 'jsonwebtoken'
import { v2 as cloudinary } from 'cloudinary'
import doctorModel from '../model/doctorModel.js'
import appointmentModel from '../model/appointmentModel.js'
import razorpay from 'razorpay'

//API TO REGISTER USER

const registerUser = async (req, res) => {
    try {

        const { name, email, password } = req.body

        if (!name || !password || !email) {
            return res.json({ success: false, message: "Missing Details" })
        }


        if (!validator.isEmail(email)) {
            return res.json({ success: false, message: "Enter a Valid Email" })
        }


        if (password.length < 8) {
            return res.json({ success: false, message: "Enter a Valid Password" })
        }

        const salt = await bcrypt.genSalt(10)
        const hasedPassword = await bcrypt.hash(password, salt)

        const userData = {
            name, email, password: hasedPassword
        }

        const newUser = new userModel(userData)
        const user = await newUser.save()


        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET)

        res.json({ success: true, token })



    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

//API FOR USER LOGIN

const loginUser = async (req, res) => {
    try {


        const { email, password } = req.body
        const user = await userModel.findOne({ email })

        if (!user) {
            return res.json({ success: false, message: "User does not exist" })

        }

        const isMatch = await bcrypt.compare(password, user.password)

        if (isMatch) {
            const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET)
            res.json({ success: true, token })
        } else {
            res.json({ success: false, message: 'Invalid credentials' })
        }

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })

    }
}



//API to get user profile data

const getProfile = async (req, res) => {
    try {
        // const { userId } = req.body;

        const userData = await userModel.findById(req.userId).select('-password')

        res.json({ success: true, userData })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}


const updateProfile = async (req, res) => {
    try {


        // const { userId } = req.body;
        const { name, address, gender, dob, phone } = req.body
        const imageFile = req.file

        if (!name || !gender || !dob || !phone) {
            return res.json({ success: false, message: 'Data Missing' })
        }

        await userModel.findByIdAndUpdate(req.userId, { name, address: JSON.parse(address), gender, dob, phone })



        if (imageFile) {
            const imageUpload = await cloudinary.uploader.upload(imageFile.path, { resource_type: 'image' })
            const imageUrl = imageUpload.secure_url



            await userModel.findByIdAndUpdate(req.userId, { image: imageUrl })


        }
        res.json({ success: true, message: 'profile updated' })


    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}


//api tp book appointment

const bookAppointment = async (req, res) => {
    try {

        const { userId, docId, slotDate, slotTime } = req.body

        const docData = await doctorModel.findById(docId).select('-password')

        if (!docData.available) {
            return res.json({ success: false, message: 'Doctor not available' })
        }

        let slots_booked = docData.slots_booked

        //checking for slot availability

        if (slots_booked[slotDate]) {
            if (slots_booked[slotDate].includes(slotTime)) {
                return res.json({ success: false, message: 'Slot not available' })

            } else {
                slots_booked[slotDate].push(slotTime)
            }
        } else {
            slots_booked[slotDate] = []
            slots_booked[slotDate].push(slotTime)
        }

        const userData = await userModel.findById(userId).select('-password')

        delete docData.slots_booked

        const appointmentData = {
            userId,
            docId,
            userData,
            docData,
            amount: docData.fees,
            slotTime, slotDate,
            date: Date.now()
        }


        const newAppointment = new appointmentModel(appointmentData)
        await newAppointment.save()

        // save new slots data in DocData

        await doctorModel.findByIdAndUpdate(docId, { slots_booked })

        res.json({ success: true, message: 'Appointment Booked' })



    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })

    }
}

//api to get user appointment for my-appointment page

const listAppointment = async (req, res) => {
    try {
        const { userId } = req.body
        const appointments = await appointmentModel.find({ userId })

        res.json({ success: true, appointments })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

//api to cancel appointment

const cancelAppointment = async (req, res) => {
    try {

        const { userId, appointmentId } = req.body

        const appointmentData = await appointmentModel.findById(appointmentId)

        //verify appointment user

        if (appointmentData.userId !== userId) {
            return res.json({ success: false, message: 'Unauthorized action' })
        }

        await appointmentModel.findByIdAndUpdate(appointmentId, { cancelled: true })

        //releasing doc slot


        const { docId, slotDate, slotTime } = appointmentData

        const doctoData = await doctorModel.findById(docId)

        let slots_booked = doctoData.slots_booked

        slots_booked[slotDate] = slots_booked[slotDate].filter(e => e !== slotTime)

        await doctorModel.findByIdAndUpdate(docId, { slots_booked })

        res.json({ success: true, message: 'Appointment cancelled' })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

//api for razorpay payment

const razorpayInstance = new razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
})

const paymentRazorpay = async (req, res) => {

    try {


        const { appointmentId } = req.body
        const appointmentData = await appointmentModel.findById(appointmentId)

        if (!appointmentData || appointmentData.cancelled) {
            return res.json({ success: false, message: "appointment cancelled or not found" })
        }

        //create option for razorpay

        const options = {
            amount: appointmentData.amount * 100,
            currency: process.env.CURRENCY,
            receipt: appointmentId,
        }

        //creation of order

        const order = await razorpayInstance.orders.create(options)

        res.json({ success: true, order })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

//Api to verify payment of razorpay
const verifyRazorpay = async (req, res) => {
    try {
        const { razorpay_order_id } = req.body
        const orderInfo = await razorpayInstance.orders.fetch(razorpay_order_id)

        // console.log(orderInfo)
        if (orderInfo.status === 'paid') {
            await appointmentModel.findByIdAndUpdate(orderInfo.receipt, { payment: true })
            res.json({ success: true, message: "Payment successful" })
        } else {
            res.json({ success: false, message: "payment failed" })
        }
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

export { registerUser, getProfile, loginUser, updateProfile, bookAppointment, listAppointment, cancelAppointment, paymentRazorpay, verifyRazorpay }