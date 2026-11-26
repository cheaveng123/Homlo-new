// EDIT JOB. Fields: photo, title, salary (hourly / monthly / yearly), positions, location (+ virtual, + map picker), description, requirements.
// Replace the useState seeds with your existing form state and save() with your existing mutation.
import React,{useEffect,useState} from 'react';
import {View,Text,TextInput,Pressable,KeyboardAvoidingView,Platform,ScrollView} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useLocalSearchParams,router} from '@/lib/router';
import Animated,{FadeIn,FadeOut,ZoomIn,ZoomOut,LinearTransition,useSharedValue,useAnimatedStyle,withSpring,withSequence,withTiming,interpolateColor} from 'react-native-reanimated';
import {c,f,sh} from './NewTheme';
import {Icon,Circ,Btn,Pill,Sec,Reveal,Press} from './NewUI';
import {R,go} from './NewRoutes';

const PER=['Hourly','Monthly','Yearly'];const SUF:Record<string,string>={Hourly:'/hr',Monthly:'/mo',Yearly:'/yr'};
function Field({label,multi,...p}:any){
  const [on,setOn]=useState(false);const k=useSharedValue(0);useEffect(()=>{k.value=withTiming(on?1:0,{duration:180})},[on]);
  const a=useAnimatedStyle(()=>({borderColor:interpolateColor(k.value,[0,1],[c.line,c.teal]),borderWidth:1+k.value}));
  return <Animated.View style={[{borderRadius:16,backgroundColor:'#fff',paddingHorizontal:16,paddingTop:8,paddingBottom:multi?8:4},a]}><Text style={{fontFamily:f.b,fontSize:12,color:c.mu}}>{label}</Text>
    <TextInput {...p} multiline={multi} onFocus={()=>setOn(true)} onBlur={()=>setOn(false)} placeholderTextColor={c.mu} style={{fontFamily:f.m,fontSize:15,color:c.tx,minHeight:multi?80:36,textAlignVertical:multi?'top':'center',padding:0}}/></Animated.View>;
}
function Seg({v,on}:{v:string;on:(k:string)=>void}){
  const [w,setW]=useState(0);const x=useSharedValue(0);useEffect(()=>{x.value=withSpring(PER.indexOf(v)*w,{damping:18,stiffness:220})},[v,w]);const a=useAnimatedStyle(()=>({transform:[{translateX:x.value}]}));
  return <View onLayout={e=>setW((e.nativeEvent.layout.width-8)/3)} style={{flexDirection:'row',padding:4,borderRadius:14,backgroundColor:c.bg}}>
    <Animated.View style={[{position:'absolute',left:4,top:4,bottom:4,width:w,borderRadius:12,backgroundColor:'#fff'},sh,a]}/>
    {PER.map(k=><Pressable key={k} accessibilityRole="tab" onPress={()=>on(k)} style={{flex:1,height:44,alignItems:'center',justifyContent:'center'}}><Text style={{fontFamily:f.s,fontSize:14,color:v===k?c.deep:c.mu}}>{k}</Text></Pressable>)}</View>;
}
function Switch({v,on}:{v:boolean;on:(b:boolean)=>void}){
  const x=useSharedValue(v?1:0);useEffect(()=>{x.value=withSpring(v?1:0,{damping:14,stiffness:220})},[v]);
  const tr=useAnimatedStyle(()=>({backgroundColor:interpolateColor(x.value,[0,1],[c.track,c.teal])}));const th=useAnimatedStyle(()=>({transform:[{translateX:x.value*20},{scaleX:1+Math.abs(0.5-x.value)*-0.0}]}));
  return <Pressable accessibilityRole="switch" accessibilityState={{checked:v}} onPress={()=>on(!v)} hitSlop={8}><Animated.View style={[{width:48,height:28,borderRadius:14,justifyContent:'center'},tr]}><Animated.View style={[{marginLeft:3,width:22,height:22,borderRadius:11,backgroundColor:'#fff'},th]}/></Animated.View></Pressable>;
}
export default function EditJob(){
  const {id='1'}=useLocalSearchParams<{id:string}>();const ins=useSafeAreaInsets();
  const [title,setTitle]=useState('Cashier (Weekend)');const [per,setPer]=useState('Hourly');const [amt,setAmt]=useState('2.2');const [pos,setPos]=useState(4);
  const [virt,setVirt]=useState(false);const [loc,setLoc]=useState('Chamkar Mon, Phnom Penh');const [desc,setDesc]=useState('Weekend cashier shifts. Handle payments and greet customers.');const [req,setReq]=useState('Friendly, reliable, able to work Saturday and Sunday.');
  const bump=useSharedValue(1);const bs=useAnimatedStyle(()=>({transform:[{scale:bump.value}]}));
  const step=(d:number)=>{setPos(p=>Math.max(1,Math.min(99,p+d)));bump.value=withSequence(withTiming(1.4,{duration:100}),withSpring(1,{damping:8}))};
  const save=()=>{/* TODO existing save mutation */router.back()};
  const Q=({t,i,children}:{t:string;i:number;children:React.ReactNode})=><Reveal i={i} style={{paddingTop:24,paddingHorizontal:16,gap:12}}><Sec t={t}/>{children}</Reveal>;
  return <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={{flex:1,backgroundColor:'#fff'}}>
    <View style={{paddingTop:ins.top+8,paddingHorizontal:16,paddingBottom:8,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderColor:c.line}}><Circ n="back" label="Back" onPress={()=>router.back()}/><Text style={{fontFamily:f.hb,fontSize:17,color:c.tx}}>Edit job</Text><View style={{width:44}}/></View>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:24}}>
      <Reveal style={{margin:16,marginBottom:0,padding:16,borderRadius:24,backgroundColor:c.cream,flexDirection:'row',alignItems:'center',gap:12}}>
        <View style={{width:44,height:44,borderRadius:22,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'}}><Icon n="bag" color={c.deep}/></View>
        <View style={{flex:1}}><Text numberOfLines={1} style={{fontFamily:f.hb,fontSize:16,color:c.deep}}>{title||'Job title'}</Text><Text numberOfLines={1} style={{fontFamily:f.b,fontSize:13,color:c.ink}}>{virt?'Virtual':loc}</Text></View><Pill clay t={`$${amt||0}${SUF[per]}`}/></Reveal>
      <Q t="Job photo" i={1}><Press onPress={()=>{/* TODO existing image picker */}} style={{height:140,borderRadius:20,borderWidth:2,borderStyle:'dashed',borderColor:c.tint2,backgroundColor:c.tint,alignItems:'center',justifyContent:'center',gap:4}}><Icon n="img" s={32} color={c.deep}/><Text style={{fontFamily:f.s,fontSize:14,color:c.deep}}>Add or change photo</Text></Press></Q>
      <Q t="Job title" i={2}><Field label="Job title" value={title} onChangeText={setTitle}/></Q>
      <Q t="Salary" i={3}><Seg v={per} on={setPer}/><Field label={`Amount (${SUF[per]})`} value={amt} onChangeText={setAmt} keyboardType="decimal-pad"/>
        <View style={{flexDirection:'row',alignItems:'center',padding:6,paddingLeft:16,borderRadius:16,borderWidth:1,borderColor:c.line}}>
          <View style={{flex:1}}><Text style={{fontFamily:f.b,fontSize:12,color:c.mu}}>Positions</Text><Animated.Text style={[{fontFamily:f.h,fontSize:20,color:c.deep,alignSelf:'flex-start'},bs]}>{pos}</Animated.Text>
            <View style={{flexDirection:'row',gap:4,marginTop:4,flexWrap:'wrap'}}>{Array.from({length:Math.min(pos,12)},(_,i)=><Animated.View key={i} entering={ZoomIn.springify()} exiting={ZoomOut.duration(120)} style={{width:8,height:8,borderRadius:4,backgroundColor:c.sun}}/>)}</View></View>
          <Circ n="minus" label="Fewer positions" onPress={()=>step(-1)}/><View style={{width:8}}/><Circ n="plus" label="More positions" onPress={()=>step(1)}/></View></Q>
      <Q t="Location" i={4}>
        <Animated.View layout={LinearTransition} style={{flexDirection:'row',alignItems:'center',gap:12,padding:12,paddingHorizontal:16,minHeight:56,borderRadius:16,backgroundColor:c.bg}}><Icon n="globe" color={c.teal}/><View style={{flex:1}}><Text style={{fontFamily:f.s,fontSize:14,color:c.tx}}>Virtual job</Text><Text style={{fontFamily:f.b,fontSize:12,color:c.mu}}>Work from anywhere</Text></View><Switch v={virt} on={setVirt}/></Animated.View>
        {!virt&&<Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(140)} style={{gap:12}}><Field label="Location" value={loc} onChangeText={setLoc}/><Btn o icon="pin" t="Select on map" onPress={()=>go(R.pickLocation(id))}/></Animated.View>}</Q>
      <Q t="Details" i={5}><Field multi label="Description" value={desc} onChangeText={setDesc}/><Field multi label="Requirements" value={req} onChangeText={setReq}/></Q>
    </ScrollView>
    <View style={{padding:16,paddingBottom:ins.bottom+16,borderTopWidth:1,borderColor:c.line,backgroundColor:'#fff'}}><Btn t="Save changes" onPress={save}/></View></KeyboardAvoidingView>;
}
