const User = require('../models/User');
const Announcement = require('../models/Announcement');

function toBool(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v.toLowerCase() === 'true';
  return undefined;
}

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

    const showEmail = toBool(req.body?.contactVisibility?.showEmail);
    const showPhone = toBool(req.body?.contactVisibility?.showPhone);
    if (showEmail !== undefined) updates['contactVisibility.showEmail'] = showEmail;
    if (showPhone !== undefined) updates['contactVisibility.showPhone'] = showPhone;

    const emailOnComment = toBool(req.body?.notificationPrefs?.emailOnComment);
    const soundOnSite = toBool(req.body?.notificationPrefs?.soundOnSite);
    if (emailOnComment !== undefined) updates['notificationPrefs.emailOnComment'] = emailOnComment;
    if (soundOnSite !== undefined) updates['notificationPrefs.soundOnSite'] = soundOnSite;

    const user = await User.findByIdAndUpdate(req.user.userId, updates, { new: true }).select('-passwordHash -__v');
    if (!user) return res.status(404).json({ message: 'Utente non trovato' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Errore server', error: err.message });
  }
};

// GET /api/users/:id/public  (auth) - masked contacts by user prefs
exports.getPublicUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('username email phoneNumber contactVisibility');
    if (!user) return res.status(404).json({ message: 'Utente non trovato' });

    const showEmail = user.contactVisibility?.showEmail !== false;
    const showPhone = user.contactVisibility?.showPhone !== false;

    res.json({
      _id: user._id,
      username: user.username,
      email: showEmail ? user.email : null,
      phoneNumber: showPhone ? user.phoneNumber : null
    });
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
