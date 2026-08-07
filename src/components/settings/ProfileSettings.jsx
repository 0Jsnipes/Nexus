import { useState } from "react";
import { toast } from "react-toastify";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../lib/authStore";
import { uploadFile } from "../../lib/storage";
import Avatar from "../shared/Avatar";

const ProfileSettings = () => {
  const profile = useAuthStore((s) => s.profile);
  const fetchProfile = useAuthStore((s) => s.fetchProfile);
  const [loading, setLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url);

  const handleAvatar = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = await uploadFile(`profile/${profile.id}`, file);
    setAvatarUrl(url);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { username, job_title, status, bio } = Object.fromEntries(new FormData(e.target));

    const { error } = await supabase
      .from("profiles")
      .update({ username, job_title, status, bio, avatar_url: avatarUrl })
      .eq("id", profile.id);

    if (error) toast.error(error.message);
    else {
      toast.success("Profile updated.");
      fetchProfile();
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="settings-form">
      <label className="onboarding-logo-picker" htmlFor="avatar">
        <Avatar src={avatarUrl} name={profile?.username} size={56} />
        <span>Change avatar</span>
      </label>
      <input type="file" id="avatar" accept="image/*" style={{ display: "none" }} onChange={handleAvatar} />

      <div className="nx-field">
        <label>Username</label>
        <input className="nx-input" name="username" defaultValue={profile?.username} required />
      </div>
      <div className="nx-field">
        <label>Job title</label>
        <input className="nx-input" name="job_title" defaultValue={profile?.job_title} />
      </div>
      <div className="nx-field">
        <label>Status</label>
        <input className="nx-input" name="status" placeholder="e.g. In a meeting" defaultValue={profile?.status} />
      </div>
      <div className="nx-field">
        <label>Bio</label>
        <textarea className="nx-textarea" name="bio" rows={3} defaultValue={profile?.bio} />
      </div>
      <button type="submit" className="nx-btn nx-btn-primary" disabled={loading}>{loading ? "Saving..." : "Save changes"}</button>
    </form>
  );
};

export default ProfileSettings;
