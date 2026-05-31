const User = require('../models/User');
const Announcement = require('../models/Announcement');
const { writeAuditLog } = require('../services/auditService');
const mongoose = require('mongoose');

/**
 * Converts boolean-like request values to booleans.
 * @param {boolean|string} v - Request value received from JSON or form data.
 * @returns {boolean|undefined} Parsed boolean, or undefined when the value cannot be interpreted.
 */
function toBool(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v.toLowerCase() === 'true';
  return undefined;
}

/**
 * Validates and normalizes a GeoJSON point location payload.
 * @param {Object} input - Object expected to contain a two-number `coordinates` array.
 * @returns {{type: string, coordinates: number[]}|null} GeoJSON Point payload, or null for invalid coordinates.
 */
function normalizeLocation(input) {
  const coords = input?.coordinates;
  if (!Array.isArray(coords) || coords.length !== 2) return null;
  const normalized = coords.map(Number);
  if (normalized.some(Number.isNaN)) return null;
  return { type: 'Point', coordinates: normalized };
}

/**
 * Handles the get me API request and writes the HTTP response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-passwordHash -__v');
    if (!user) return res.status(404).json({ message: 'Utente non trovato' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Errore server', error: err.message });
  }
};

/**
 * Handles the update me API request and writes the HTTP response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
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
    if (emailOnComment !== undefined) updates['notificationPrefs.emailOnComment'] = emailOnComment;

    if (req.body?.rifugioData?.location !== undefined) {
      const me = await User.findById(req.user.userId).select('role rifugioStatus');
      if (!me) return res.status(404).json({ message: 'Utente non trovato' });
      if (me.role !== 'shelter' || me.rifugioStatus !== 'approved') {
        return res.status(403).json({ message: 'Solo un rifugio approvato puo salvare la posizione' });
      }
      const location = normalizeLocation(req.body.rifugioData.location);
      if (!location) return res.status(400).json({ message: 'Coordinate rifugio non valide' });
      updates['rifugioData.location'] = location;
    }

    const userDoc = await User.findById(req.user.userId);
    if (!userDoc) return res.status(404).json({ message: 'Utente non trovato' });

    userDoc.set(updates);
    const savedUser = await userDoc.save();
    const user = savedUser.toObject();
    delete user.passwordHash;
    delete user.__v;

    if (!user) return res.status(404).json({ message: 'Utente non trovato' });
    await writeAuditLog({ actor: user, action: 'modificato profilo', target: null });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Errore server', error: err.message });
  }
};

/**
 * Handles the get public user API request and writes the HTTP response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
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

/**
 * Handles the get public rifugi API request and writes the HTTP response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
exports.getPublicRifugi = async (req, res) => {
  try {
    const isPublic = req.query?.isPublic;
    if (isPublic !== undefined && String(isPublic).toLowerCase() !== 'true') {
      return res.json([]);
    }

    const rifugi = await User.find({
      role: 'shelter',
      rifugioStatus: 'approved',
      'rifugioData.location.coordinates.0': { $exists: true },
      'rifugioData.location.coordinates.1': { $exists: true }
    }).select('username email phoneNumber contactVisibility rifugioData');

    res.json(rifugi.map((rifugio) => {
      const showEmail = rifugio.contactVisibility?.showEmail !== false;
      const showPhone = rifugio.contactVisibility?.showPhone !== false;
      return {
        _id: rifugio._id,
        username: rifugio.username,
        email: showEmail ? rifugio.email : null,
        phoneNumber: showPhone ? rifugio.phoneNumber : null,
        rifugioData: rifugio.rifugioData
      };
    }));
  } catch (err) {
    res.status(500).json({ message: 'Errore recupero rifugi', error: err.message });
  }
};

/**
 * Formats a followed shelter for API responses while honoring contact visibility.
 * @param {Object} shelter - Shelter user document included in the follower list.
 * @param {boolean} emailEnabled - Whether the follower wants email notifications for this shelter.
 * @returns {Object} Public shelter payload enriched with the follower email preference.
 */
function formatShelterPayload(shelter, emailEnabled) {
  const showEmail = shelter.contactVisibility?.showEmail !== false;
  const showPhone = shelter.contactVisibility?.showPhone !== false;
  return {
    _id: shelter._id,
    username: shelter.username,
    email: showEmail ? shelter.email : null,
    phoneNumber: showPhone ? shelter.phoneNumber : null,
    rifugioData: shelter.rifugioData,
    emailEnabled: !!emailEnabled
  };
}

/**
 * Handles the get followed shelters API request and writes the HTTP response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
exports.getFollowedShelters = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .select('followedShelters')
      .populate('followedShelters.shelterId', 'username email phoneNumber contactVisibility rifugioData role rifugioStatus');

    if (!user) return res.status(404).json({ message: 'Utente non trovato' });

    const followed = (user.followedShelters || [])
      .filter(item => item.shelterId && item.shelterId.role === 'shelter' && item.shelterId.rifugioStatus === 'approved')
      .map(item => formatShelterPayload(item.shelterId, item.emailEnabled));

    res.json(followed);
  } catch (err) {
    res.status(500).json({ message: 'Errore recupero rifugi seguiti', error: err.message });
  }
};

/**
 * Handles the follow shelter API request and writes the HTTP response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
exports.followShelter = async (req, res) => {
  try {
    const shelterId = req.params.shelterId;
    if (!mongoose.Types.ObjectId.isValid(shelterId)) {
      return res.status(400).json({ message: 'ID rifugio non valido' });
    }

    const me = await User.findById(req.user.userId).select('role followedShelters');
    if (!me) return res.status(404).json({ message: 'Utente non trovato' });
    if (me.role !== 'user') return res.status(403).json({ message: 'Solo gli utenti possono seguire un rifugio' });
    if (String(me._id) === String(shelterId)) return res.status(400).json({ message: 'Non puoi seguire il tuo account' });

    const shelter = await User.findOne({ _id: shelterId, role: 'shelter', rifugioStatus: 'approved', isActive: true })
      .select('username email phoneNumber contactVisibility rifugioData role rifugioStatus');
    if (!shelter) return res.status(404).json({ message: 'Rifugio non trovato o non approvato' });

    const emailEnabled = toBool(req.body?.emailEnabled) === true;
    const existing = (me.followedShelters || []).find(item => String(item.shelterId) === String(shelterId));

    if (existing) {
      existing.emailEnabled = emailEnabled;
    } else {
      me.followedShelters.push({ shelterId, emailEnabled });
    }

    await me.save();
    await writeAuditLog({ actor: me, action: 'seguito rifugio', target: shelter });
    res.json(formatShelterPayload(shelter, emailEnabled));
  } catch (err) {
    res.status(500).json({ message: 'Errore follow rifugio', error: err.message });
  }
};

/**
 * Handles the unfollow shelter API request and writes the HTTP response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
exports.unfollowShelter = async (req, res) => {
  try {
    const shelterId = req.params.shelterId;
    if (!mongoose.Types.ObjectId.isValid(shelterId)) {
      return res.status(400).json({ message: 'ID rifugio non valido' });
    }

    const user = await User.findById(req.user.userId).select('followedShelters role');
    if (!user) return res.status(404).json({ message: 'Utente non trovato' });
    if (user.role !== 'user') return res.status(403).json({ message: 'Solo gli utenti possono smettere di seguire un rifugio' });

    const before = user.followedShelters.length;
    user.followedShelters = user.followedShelters.filter(item => String(item.shelterId) !== String(shelterId));
    await user.save();

    if (before !== user.followedShelters.length) {
      await writeAuditLog({ actor: user, action: 'non segue piu rifugio', target: shelterId });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Errore unfollow rifugio', error: err.message });
  }
};


const {
   removeAnnouncementCascade
} = require('./announcementController');

/**
 * Handles the delete me API request and writes the HTTP response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
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

        const user = await User.findByIdAndDelete(userId).select('username');
        await writeAuditLog({ actor: user || userId, action: 'eliminato account', target: null });

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
