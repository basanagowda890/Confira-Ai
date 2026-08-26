import { Bell, Building2, LockKeyhole, Save, Shield, UserRound } from "lucide-react";
import { useState } from "react";
import SectionTitle from "../../components/SectionTitle";
import Toast from "../../components/Toast";

export default function Settings() {
  const [toast,setToast]=useState("");
  function save(){setToast("Settings saved");setTimeout(()=>setToast(""),2000)}
  return <div><Toast message={toast} onClose={()=>setToast("")}/><SectionTitle eyebrow="SETTINGS" title="Company settings" description="Manage your workspace, account and monitoring preferences." />
    <div className="two-col"><section className="card"><div className="card-head"><div><h3><Building2 size={18}/> Company profile</h3><p>Public hiring workspace details.</p></div></div><div className="form-grid"><label>Company name<input defaultValue="Confira Labs"/></label><label>Admin email<input defaultValue="hiring@confira.example"/></label><label className="span-2">Company description<textarea defaultValue="AI products and engineering." /></label></div><button className="btn btn-primary" onClick={save}><Save size={16}/> Save</button></section>
    <section className="card"><div className="card-head"><div><h3><Shield size={18}/> Monitoring policy</h3><p>Configure what interview sessions may collect.</p></div></div>{[["Camera presence","Detect face visibility and single-person presence",true],["Screen sharing","Show candidate screen during live interviews",true],["Focus/tab alerts","Surface focus changes to the interviewer",true],["Voice analysis","Analyze speech quality and pronunciation",false],["Expression authenticity","Show research signal as a review aid",false]].map(([x,y,on])=><div className="setting-row" key={x}><div><b>{x}</b><p>{y}</p></div><input type="checkbox" defaultChecked={on}/></div>)}</section></div>
    <section className="card settings-bottom"><div className="settings-section"><UserRound size={18}/><div><h3>Account</h3><p>Update your name and profile photo.</p></div><button className="btn btn-outline" onClick={save}>Edit</button></div><div className="settings-section"><LockKeyhole size={18}/><div><h3>Security</h3><p>Change password and manage sessions.</p></div><button className="btn btn-outline" onClick={save}>Manage</button></div><div className="settings-section"><Bell size={18}/><div><h3>Notifications</h3><p>Configure email and live alert preferences.</p></div><button className="btn btn-outline" onClick={save}>Configure</button></div></section>
  </div>;
}