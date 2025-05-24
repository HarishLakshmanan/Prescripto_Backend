import validator from 'validator'
import bcrypt from 'bcrypt'
import userModel from '../model/userModel.js'
import jwt from 'jsonwebtoken'
import { v2 as cloudinary } from 'cloudinary'
import doctorModel from '../model/doctorModel.js'

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
        const userId = req.userId;

        const userData = await userModel.findById(userId).select('-password')

        res.json({ success: true, userData })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}


const updateProfile = async (req, res) => {
    try {


        const userId = req.userId;
        const { name, address, gender, dob, phone } = req.body
        const imageFile = req.file

        if (!name || !gender || !dob || !phone) {
            return res.json({ success: false, message: 'Data Missing' })
        }

        await userModel.findByIdAndUpdate(userId, { name, address: JSON.parse(address), gender, dob, phone })



        if (imageFile) {
            const imageUpload = await cloudinary.uploader.upload(imageFile.path, { resource_type: 'image' })
            const imageUrl = imageUpload.secure_url



            await userModel.findByIdAndUpdate(userId, { image: imageUrl })


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

            }else{
                slots_booked[slotDate].push(slotTime)
            }
        }else{
            slots_booked[slotDate]=[]
            slots_booked[slotDate].push(slotTime)
        }

        const userData = await userModel.findById(userId).select('-password')

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })

    }
}

export { registerUser, getProfile, loginUser, updateProfile }