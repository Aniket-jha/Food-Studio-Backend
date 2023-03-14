const ErrorHandler = require("../utils/errorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const User = require("../models/userModels");
const sendToken = require("../utils/jwtToken");
const sendEmail = require("../utils/sendEmails.js");
const cloudinary = require("cloudinary")
const crypto = require("crypto");
exports.registerUser = catchAsyncErrors(async (req, res, next) => {

  const my_cloud = await cloudinary.v2.uploader.upload(req.body.avatar,{
    folder:"avatars",
    width:150,
    crop:"scale"
  })
    const {name,email,password} = req.body;
    const user = await User.create({name,email,password,avatar:{
         public_id: my_cloud.public_id,
      url: my_cloud.secure_url,
    }});

    sendToken(user,201,res);

});

exports.loginUser = catchAsyncErrors(async (req, res, next) => {
  const { email, password } = req.body;

  // checking if user has given password and email both

  if (!email || !password) {
    return next(new ErrorHander("Please Enter Email & Password", 400));
  }

  const user = await User.findOne({ email }).select("+password");

  if (!user) {
    return next(new ErrorHandler("Invalid email or password", 401));
  }

  const isPasswordMatched = await user.comparePassword(password);

  if (!isPasswordMatched) {
    return next(new ErrorHandler("Invalid email or password", 401));
  }

  sendToken(user, 200, res);
});


exports.logout = catchAsyncErrors(async(req,res,next)=>{
    res.cookie("token",null,{
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true
    })
    res.status(200).json({
        sucess: true,
        message:"Logout Successfully"
    })
})

//forget passowrd

exports.forgotPassword = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }

  // Get ResetPassword Token
  const resetToken = user.getResetPasswordToken();

  await user.save({ validateBeforeSave: false });

  const resetPasswordUrl = `${req.protocol}://${req.get(
    "host"
  )}/api/v1/password/reset/${resetToken}`;

  const message = `Your password reset token is :- \n\n ${resetPasswordUrl} \n\nIf you have not requested this email then, please ignore it.`;

  try {
    await sendEmail({
      email: user.email,
      subject: `Ecommerce Password Recovery`,
      message,
    });

    res.status(200).json({
      success: true,
      message: `Email sent to ${user.email} successfully`,
    });
  } catch (error) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save({ validateBeforeSave: false });

    return next(new ErrorHandler(error.message, 500));
  }
});

exports.resetPassword = catchAsyncErrors(async (req, res, next) => {
   const resetPasswordToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");


    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    })

    if (!user) {
    return next(new ErrorHandler("Reset Password token isn't valid or has been expired", 400));
  }

  if(req.body.password !== req.body.confirmPassword){
    return next(new ErrorHandler("Password and Confirm Password are not matched", 400));
  }
  user.password = req.body.password;
  user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();
    sendToken(user, 200, res);

})


exports.getUserDetails = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  
  res.status(200).json({
    success: true,
    user
  });
});


exports.updatePassword = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.user.id).select("+password");
  
   const isPasswordMatched = await user.comparePassword(req.body.oldPassword);

  if (!isPasswordMatched) {
    return next(new ErrorHandler("Old Password is incorrect", 401));
  }

  if(req.body.newPassword !== req.body.confirmPassword){
    return next(new ErrorHandler("Password and Confirm Password are not matched", 400));
  }
  user.password = req.body.newPassword;

  await user.save();

  sendToken(user, 200, res);

  
})

exports.updateProfile = catchAsyncErrors(async (req, res, next) => {
  
  const newUserData={
    name:req.body.name,
    email:req.body.email,

  }
  if (req.body.avatar !== "") {
    const user = await User.findById(req.user.id);

    const imageId = user.avatar.public_id;

    await cloudinary.v2.uploader.destroy(imageId);

    const myCloud = await cloudinary.v2.uploader.upload(req.body.avatar, {
      folder: "avatars",
      width: 150,
      crop: "scale",
    });

    newUserData.avatar = {
      public_id: myCloud.public_id,
      url: myCloud.secure_url,
    };
  }

  const user = await User.findByIdAndUpdate(req.user.id, newUserData, {
    new: true,
    runValidators: true,
    useFindAndModify: false,
  });

  res.status(200).json({
    success: true,
  });

  
})

exports.getAllUser = catchAsyncErrors(async (req, res, next) => {

  const users = await User.find();

  res.status(200).json({
    success: true,
    users
  });

})

exports.getSingleUser = catchAsyncErrors(async (req, res, next) => {

  const user = await User.findById(req.params.id);

  if (!user) {
    return next(new ErrorHandler(`User does not exist with ID:${req.params.id}`, 404));
  }
  res.status(200).json({
    sucess: true,
    user
  })

})

exports.updateProfileAdmin = catchAsyncErrors(async (req, res, next) => {
  
  const newUserData={
    name:req.body.name,
    email:req.body.email,
    role:req.body.role,
  }
  const user = await User.findByIdAndUpdate(req.user.id,newUserData,{
    new:true,
    runValidators:true,
    useFindAndModify: true,
  })

  res.status(200).json({
    success: true,
    user
  })

  sendToken(user, 200, res);

  
})

exports.deleteUserAdmin = catchAsyncErrors(async (req, res, next) => {
  
  const user = await User.findById(req.params.id);

  if(!user){
    return next(new ErrorHandler(`User does not exist with ID:${req.params.id}`, 404));
  }

  await user.remove();

  res.status(200).json({
    success: true,
    message:"User deleted successfully"
  })

  sendToken(user, 200, res);

  
})



