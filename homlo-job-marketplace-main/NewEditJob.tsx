import React,{useEffect,useMemo,useRef,useState} from 'react';
import {View,Text,TextInput,Pressable,KeyboardAvoidingView,Platform,ScrollView,Alert,Image} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useFocusEffect,useLocalSearchParams,router} from '@/lib/router';
import Animated,{FadeIn,FadeOut,ZoomIn,ZoomOut,LinearTransition,useSharedValue,useAnimatedStyle,withSequence,withTiming,interpolateColor} from 'react-native-reanimated';
import * as ImagePicker from '@/lib/native/image-picker';
import {c,f,sh} from './NewTheme';
import {Icon,Circ,Btn,Pill,Sec,Reveal,Press,Boundary} from './NewUI';
import {R,go} from './NewRoutes';
import {useAuth} from '@/hooks/use-auth';
import {trpc} from '@/lib/trpc';
import {pickerImageToJpegDataUrl} from '@/lib/profile-photo';
import {buildJobSavePayload,normalizeEmployerJob,uploadJobImage,type PayableJobStatus} from '@/lib/job-management';
import {readJobEditDraft,clearJobEditDraft} from '@/lib/job-edit-draft';
import type {JobStatus} from '@/backend/domain/models';
import {EmployerEditJobSkeleton} from '@/src/new/components/NewSkeletons';
import {useFirstLoadSkeletonFlag} from '@/lib/useFirstLoadSkeletonFlag';

import { smooth } from '@/src/design/motion';
const PER=['Hourly','Daily','Monthly'];const SUF:Record<string,string>={Hourly:'/hr',Daily:'/day',Monthly:'/mo'};
function payTypeLabel(p:string){return p==='hourly'?'Hourly':p==='daily'?'Daily':'Monthly'}
function payTypeValue(l:string):'hourly'|'daily'|'fixed'{return l==='Hourly'?'hourly':l==='Daily'?'daily':'fixed'}
function payableStatus(s:JobStatus):PayableJobStatus{return s==='draft'||s==='open'||s==='closed'||s==='cancelled'?s:'closed'}

function Field({label,multi,...p}:any){
  const [on,setOn]=useState(false);const k=useSharedValue(0);useEffect(()=>{k.value=withTiming(on?1:0,{duration:180})},[k, on]);
  const a=useAnimatedStyle(()=>({borderColor:interpolateColor(k.value,[0,1],[c.line,c.teal])}));
  return <Animated.View style={[{borderRadius:16,borderWidth:1.5,backgroundColor:'#fff',paddingHorizontal:16,paddingTop:8,paddingBottom:multi?8:4},a]}><Text style={{fontFamily:f.b,fontSize:12,color:c.mu}}>{label}</Text>
    <TextInput {...p} multiline={multi} onFocus={()=>setOn(true)} onBlur={()=>setOn(false)} placeholderTextColor={c.mu} style={{fontFamily:f.m,fontSize:15,color:c.tx,minHeight:multi?80:36,textAlignVertical:multi?'top':'center',padding:0}}/></Animated.View>;
}
function Seg({v,on}:{v:string;on:(k:string)=>void}){
  const [w,setW]=useState(0);const x=useSharedValue(0);useEffect(()=>{x.value=smooth(PER.indexOf(v)*w)},[v, w, x]);const a=useAnimatedStyle(()=>({transform:[{translateX:x.value}]}));
  return <View onLayout={e=>setW((e.nativeEvent.layout.width-8)/3)} style={{flexDirection:'row',padding:4,borderRadius:14,backgroundColor:c.bg}}>
    <Animated.View style={[{position:'absolute',left:4,top:4,bottom:4,width:w,borderRadius:12,backgroundColor:'#fff'},sh,a]}/>
    {PER.map(k=><Pressable key={k} accessibilityRole="tab" onPress={()=>on(k)} style={{flex:1,height:44,alignItems:'center',justifyContent:'center'}}><Text style={{fontFamily:f.s,fontSize:14,color:v===k?c.deep:c.mu}}>{k}</Text></Pressable>)}</View>;
}
function Switch({v,on}:{v:boolean;on:(b:boolean)=>void}){
  const x=useSharedValue(v?1:0);useEffect(()=>{x.value=smooth(v?1:0)},[v, x]);
  const tr=useAnimatedStyle(()=>({backgroundColor:interpolateColor(x.value,[0,1],[c.track,c.teal])}));const th=useAnimatedStyle(()=>({transform:[{translateX:x.value*20}]}));
  return <Pressable accessibilityRole="switch" accessibilityState={{checked:v}} onPress={()=>on(!v)} hitSlop={8}><Animated.View style={[{width:48,height:28,borderRadius:14,justifyContent:'center'},tr]}><Animated.View style={[{marginLeft:3,width:22,height:22,borderRadius:11,backgroundColor:'#fff'},th]}/></Animated.View></Pressable>;
}
const Q=({t,i,children}:{t:string;i:number;children:React.ReactNode})=><Reveal i={i} style={{paddingTop:24,paddingHorizontal:16,gap:12}}><Sec t={t}/>{children}</Reveal>;
function Screen(){
  const ins=useSafeAreaInsets();
  const {id=''}=useLocalSearchParams<{id:string}>();const {user}=useAuth();
  const utils=trpc.useUtils();
  const saveJob=trpc.homlo.employer.saveJob.useMutation();
  const jobsQuery=trpc.homlo.employer.jobs.useQuery(undefined,{enabled:Boolean(user&&id)});
  const showSkeleton=useFirstLoadSkeletonFlag(jobsQuery);
  const job=useMemo(()=>{
    const rows=(jobsQuery.data as {jobs?:unknown[]}|undefined)?.jobs??[];
    const row=rows.find(c=>(c as {id?:unknown}).id===id);
    return row?normalizeEmployerJob(row as never):null;
  },[jobsQuery.data,id]);

  const [title,setTitle]=useState('');const [per,setPer]=useState('Hourly');const [amt,setAmt]=useState('');
  const [pos,setPos]=useState(1);const [virt,setVirt]=useState(false);const [loc,setLoc]=useState('');
  const [desc,setDesc]=useState('');const [req,setReq]=useState('');const [image,setImage]=useState<string|undefined>(undefined);
  const [uploading,setUploading]=useState(false);
  const lat=useRef<number|null>(null);const lng=useRef<number|null>(null);const autoClose=useRef(true);
  const seeded=useRef(false);

  useEffect(()=>{
    if(!job||seeded.current)return;seeded.current=true;
    setTitle(job.title);setPer(payTypeLabel(job.payType));setAmt(job.payAmount>0?String(job.payAmount):'');
    setPos(Math.max(job.rolesTotal,1));setLoc(job.locationLabel??'');setDesc(job.description);setReq(job.requirements??'');
    setImage(job.imageUrl??undefined);lat.current=job.latitude;lng.current=job.longitude;autoClose.current=true;
  },[job]);

  // Two-step handoff: the map picker writes lib/job-edit-draft; re-apply on focus.
  useFocusEffect(React.useCallback(()=>{let on=true;(async()=>{if(!id)return;const d=await readJobEditDraft(id).catch(()=>null);if(!on||!d)return;if(d.locationLabel){setLoc(d.locationLabel)}lat.current=d.latitude;lng.current=d.longitude;await clearJobEditDraft(id)})().catch(()=>undefined);return()=>{on=false}},[id]));

  async function changeImage(){
    const perm=await ImagePicker.requestMediaLibraryPermissionsAsync();
    if(!perm.granted){Alert.alert('Photo access needed','Allow photo library access to change the job image.');return}
    const res=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],quality:0.8,allowsEditing:true,aspect:[16,9]});
    if(res.canceled||!res.assets?.[0])return;
    setUploading(true);
    try{const dataUrl=await pickerImageToJpegDataUrl(res.assets[0],{maxWidth:1600});const {url}=await uploadJobImage(id,dataUrl);setImage(url)}catch{Alert.alert("Couldn't upload image",'Try again in a moment.')}finally{setUploading(false)}
  }
  const bump=useSharedValue(1);const bs=useAnimatedStyle(()=>({transform:[{scale:bump.value}]}));
  const step=(d:number)=>{setPos(p=>Math.max(1,Math.min(99,p+d)));bump.set(withSequence(withTiming(1.4,{duration:100}),smooth(1)))};
  const [saving,setSaving]=useState(false);
  async function save(){
    if(!job||saving)return;
    if(!title.trim()){Alert.alert('Add a job title','Job title cannot be empty.');return}
    const payAmount=Number(amt);
    if(!payAmount||payAmount<=0){Alert.alert('Check the salary','Enter a salary amount greater than 0.');return}
    if(job.status!=='draft'&&!desc.trim()){Alert.alert('Add a description','A short description is required for a published job.');return}
    setSaving(true);
    try{
      await saveJob.mutateAsync(buildJobSavePayload({
        title,description:desc,requirements:req,category:job.category,imageUrl:image??null,
        locationLabel:loc,latitude:lat.current,longitude:lng.current,payAmount,payCurrency:job.payCurrency,
        payType:payTypeValue(per),rolesTotal:pos,
      },{jobId:job.id,imageUrl:image??null,status:payableStatus(job.status),autoCloseEnabled:autoClose.current}));
      void utils.homlo.employer.jobs.invalidate();
      void utils.homlo.publicJobs.invalidate();
      void utils.homlo.searchJobs.invalidate();
      void utils.homlo.homeFeed.invalidate();
      Alert.alert('Changes saved','Your listing is updated and applicants will see the new details.',[{text:'Done',onPress:()=>router.back()}]);
    }catch(err){const message=err instanceof Error?err.message.trim():'';Alert.alert("Couldn't save changes",message||'Try again in a moment.')}finally{setSaving(false)}
  }
  if(showSkeleton)return <View style={{flex:1,backgroundColor:'#fff'}}><EmployerEditJobSkeleton/></View>;
  if(!user||!job)return <View style={{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:'#fff',padding:24,gap:14}}>
    <Text style={{fontFamily:f.m,fontSize:14,color:c.mu,textAlign:'center'}}>{!user?'Sign in to edit this job.':'This listing is no longer available.'}</Text>
    <Btn o t={!user?'Sign in':'Back to listed jobs'} onPress={()=>router.replace(!user?('/login' as never):('/employer' as never))}/></View>;
  return <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={{flex:1,backgroundColor:'#fff'}}>
    <View style={{paddingTop:ins.top+8,paddingHorizontal:16,paddingBottom:8,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderColor:c.line}}><Circ n="back" label="Back" onPress={()=>router.back()}/><Text style={{fontFamily:f.hb,fontSize:17,color:c.tx}}>Edit job</Text><View style={{width:44}}/></View>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:24}}>
      <Reveal style={{margin:16,marginBottom:0,padding:16,borderRadius:24,backgroundColor:c.cream,flexDirection:'row',alignItems:'center',gap:12}}>
        <View style={{width:44,height:44,borderRadius:22,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'}}><Icon n="bag" color={c.deep}/></View>
        <View style={{flex:1}}><Text numberOfLines={1} style={{fontFamily:f.hb,fontSize:16,color:c.deep}}>{title||'Job title'}</Text><Text numberOfLines={1} style={{fontFamily:f.b,fontSize:13,color:c.ink}}>{virt?'Virtual':(loc||'Location to be confirmed')}</Text></View><Pill clay t={`$${amt||0}${SUF[per]}`}/></Reveal>
      <Q t="Job photo" i={1}>{image?
        <Press onPress={()=>void changeImage()} style={{height:140,borderRadius:20,overflow:'hidden',backgroundColor:c.tint}}><Image source={{uri:image}} style={{width:'100%',height:'100%'}}/>{uploading&&<View style={{position:'absolute',inset:0,backgroundColor:'rgba(0,0,0,0.25)',alignItems:'center',justifyContent:'center'}}><Text style={{fontFamily:f.s,fontSize:14,color:'#fff'}}>Uploading…</Text></View>}</Press>:
        <Press onPress={()=>void changeImage()} style={{height:140,borderRadius:20,borderWidth:2,borderStyle:'dashed',borderColor:c.tint2,backgroundColor:c.tint,alignItems:'center',justifyContent:'center',gap:4}}><Icon n="img" s={32} color={c.deep}/><Text style={{fontFamily:f.s,fontSize:14,color:c.deep}}>{uploading?'Uploading…':'Add or change photo'}</Text></Press>}</Q>
      <Q t="Job title" i={2}><Field label="Job title" value={title} onChangeText={setTitle}/></Q>
      <Q t="Salary" i={3}><Seg v={per} on={setPer}/><Field label={`Amount (${SUF[per]})`} value={amt} onChangeText={setAmt} keyboardType="decimal-pad"/>
        <View style={{flexDirection:'row',alignItems:'center',padding:6,paddingLeft:16,borderRadius:16,borderWidth:1,borderColor:c.line}}>
          <View style={{flex:1}}><Text style={{fontFamily:f.b,fontSize:12,color:c.mu}}>Positions</Text><Animated.Text style={[{fontFamily:f.h,fontSize:20,color:c.deep,alignSelf:'flex-start'},bs]}>{pos}</Animated.Text>
            <View style={{flexDirection:'row',gap:4,marginTop:4,flexWrap:'wrap'}}>{Array.from({length:Math.min(pos,12)},(_,i)=><Animated.View key={i} entering={ZoomIn} exiting={ZoomOut.duration(120)} style={{width:8,height:8,borderRadius:4,backgroundColor:c.sun}}/>)}</View></View>
          <Circ n="minus" label="Fewer positions" onPress={()=>step(-1)}/><View style={{width:8}}/><Circ n="plus" label="More positions" onPress={()=>step(1)}/></View></Q>
      <Q t="Location" i={4}>
        <Animated.View layout={LinearTransition} style={{flexDirection:'row',alignItems:'center',gap:12,padding:12,paddingHorizontal:16,minHeight:56,borderRadius:16,backgroundColor:c.bg}}><Icon n="globe" color={c.teal}/><View style={{flex:1}}><Text style={{fontFamily:f.s,fontSize:14,color:c.tx}}>Virtual job</Text><Text style={{fontFamily:f.b,fontSize:12,color:c.mu}}>Work from anywhere</Text></View><Switch v={virt} on={setVirt}/></Animated.View>
        {!virt&&<Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(140)} style={{gap:12}}><Field label="Location" value={loc} onChangeText={setLoc}/><Btn o icon="pin" t="Select on map" onPress={()=>go(R.pickLocation(id))}/></Animated.View>}</Q>
      <Q t="Details" i={5}><Field multi label="Description" value={desc} onChangeText={setDesc}/><Field multi label="Requirements" value={req} onChangeText={setReq}/></Q>
    </ScrollView>
    <View style={{padding:16,paddingBottom:ins.bottom+16,borderTopWidth:1,borderColor:c.line,backgroundColor:'#fff'}}><Btn t={saving?'Saving…':'Save changes'} onPress={()=>void save()}/></View></KeyboardAvoidingView>;
}
export default function NewEditJob(){console.log('NEW EditJob mounted');return <Boundary><Screen/></Boundary>}