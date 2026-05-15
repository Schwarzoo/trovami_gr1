const User = require('../models/User');

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

exports.deleteMe = async (req, res) => {
  try {
    console.log('DELETE /api/users/me called for user=', req.user);
    // Optionally: cascade-delete user resources (announcements, animals) here
    await User.findByIdAndDelete(req.user.userId);
    console.log('User deleted:', req.user.userId);
    res.json({ message: 'Account eliminato' });
  } catch (err) {
    console.error('Errore in deleteMe:', err);
    res.status(500).json({ message: 'Errore server', error: err.message });
  }
};
