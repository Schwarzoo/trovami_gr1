const User = require('../models/User');
const Announcement = require('../models/Announcement');

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-passwordHash -__v');
    if (!user) return res.status(404).json({ message: 'Utente non trovato' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Errore server', error: err.message });
  }
};

exports.updateMe = async (req, res) => {
  try {
    const updates = {};
    const allowed = ['username', 'phoneNumber'];
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    const user = await User.findByIdAndUpdate(req.user.userId, updates, { new: true }).select('-passwordHash -__v');
    if (!user) return res.status(404).json({ message: 'Utente non trovato' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Errore server', error: err.message });
  }
};


const {
   removeAnnouncementCascade
} = require('./announcementController');

exports.deleteMe = async(req,res)=>{

    try{

        const userId = req.user.userId;

        const announcements =
            await Announcement.find({
                publisherId:userId
            });

        for(const ann of announcements){

            await removeAnnouncementCascade(
                ann._id
            );
        }

        await User.findByIdAndDelete(
            userId
        );

        res.json({
            success:true
        });

    }catch(err){

        console.error(err);

        res.status(500).json({
            message:err.message
        });
    }
};
