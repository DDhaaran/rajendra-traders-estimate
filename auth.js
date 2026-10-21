(function(){
  'use strict';

  var SESSION_KEY='rq_supabase_session';
  var USER_KEY='rq_active_user_id';
  var LEGACY_OWNER_KEY='rq_legacy_owner_id';
  var SIGNOUT_NOTICE_KEY='rq_signout_notice';
  var baseUrl=String(window.RQ_SUPABASE_URL||'').replace(/\/+$/,'');
  var anonKey=String(window.RQ_SUPABASE_ANON_KEY||'').trim();
  var gate=document.getElementById('authGate');
  var form=document.getElementById('authForm');
  var emailInput=document.getElementById('authEmail');
  var passwordInput=document.getElementById('authPassword');
  var submitButton=document.getElementById('authSubmit');
  var signUpButton=document.getElementById('authSignUp');
  var resetButton=document.getElementById('authReset');
  var backButton=document.getElementById('authBack');
  var message=document.getElementById('authMessage');
  var mode='signin';
  var recoveryToken='';

  function setMessage(text,isError){
    message.textContent=text||'';
    message.classList.toggle('error',!!isError);
  }
  function setMode(next){
    mode=next;
    passwordInput.value='';
    passwordInput.autocomplete=next==='signin'?'current-password':'new-password';
    submitButton.textContent=next==='signin'?'Sign in':next==='signup'?'Create account':'Save new password';
    signUpButton.hidden=next!=='signin';
    resetButton.hidden=next!=='signin';
    backButton.hidden=next==='signin';
    emailInput.required=next!=='new-password';
    document.getElementById('authHint').textContent=next==='signup'
      ?'Create an account with your email address and a password.'
      :next==='reset'
        ?'Enter your email address and we will send a password reset link.'
        :next==='new-password'
          ?'Choose a new password for your account.'
          :'Use your email address and password to continue.';
    passwordInput.required=next!=='reset';
    passwordInput.hidden=next==='reset';
  }
  function readSession(){
    try{
      var value=window.localStorage.getItem(SESSION_KEY);
      return value?JSON.parse(value):null;
    }catch(e){
      return null;
    }
  }
  function saveSession(session){
    try{
      window.localStorage.setItem(SESSION_KEY,JSON.stringify(session));
      return true;
    }catch(e){
      setMessage('Could not save the sign-in session on this device. Check browser storage settings.',true);
      return false;
    }
  }
  function clearSession(){
    try{
      window.localStorage.removeItem(SESSION_KEY);
      window.localStorage.removeItem(USER_KEY);
    }catch(e){
      setMessage('Could not clear the sign-in session. Check browser storage settings.',true);
      return false;
    }
    return true;
  }
  function migrateLegacyData(userId){
    var keys=['rajendra_quote_settings_v1','rajendra_quote_products_v1','rajendra_quote_draft_v2'];
    try{
      var owner=window.localStorage.getItem(LEGACY_OWNER_KEY);
      if(owner&&owner!==userId) return true;
      if(!owner) window.localStorage.setItem(LEGACY_OWNER_KEY,userId);
      keys.forEach(function(key){
        var legacyValue=window.localStorage.getItem(key);
        var scopedKey='rq_user_'+encodeURIComponent(userId)+'_'+key;
        if(legacyValue!==null&&window.localStorage.getItem(scopedKey)===null){
          window.localStorage.setItem(scopedKey,legacyValue);
        }
      });
      return true;
    }catch(e){
      setMessage('Could not preserve this device’s existing quotation data. Free up browser storage and try again.',true);
      return false;
    }
  }
  function request(path,options){
    options=options||{};
    var headers=options.headers||{};
    headers.apikey=anonKey;
    headers['Content-Type']='application/json';
    return fetch(baseUrl+path,{
      method:options.method||'POST',
      headers:headers,
      body:options.body?JSON.stringify(options.body):undefined
    }).then(function(response){
      return response.text().then(function(text){
        var data=null;
        try{ data=text?JSON.parse(text):null; }catch(e){}
        if(!response.ok){
          var err=new Error(data&&(data.msg||data.message||data.error_description)||'Authentication request failed ('+response.status+').');
          err.status=response.status;
          throw err;
        }
        return data;
      });
    }).catch(function(error){
      if(error.status) throw error;
      var networkError=new Error('Could not reach Supabase. Check your internet connection and project URL.');
      networkError.network=true;
      throw networkError;
    });
  }
  function sessionFrom(data){
    if(!data||!data.access_token||!data.user||!data.user.id) return null;
    var expires=Number(data.expires_at)||Math.floor(Date.now()/1000)+(Number(data.expires_in)||3600);
    return {
      access_token:data.access_token,
      refresh_token:data.refresh_token||'',
      expires_at:expires,
      user:{id:data.user.id,email:data.user.email||''}
    };
  }
  function activate(session){
    if(!saveSession(session)) return;
    try{
      var currentUser=window.localStorage.getItem(USER_KEY)||'';
      if(!currentUser&&!migrateLegacyData(session.user.id)) return;
      window.localStorage.setItem(USER_KEY,session.user.id);
      if(currentUser!==session.user.id){
        window.location.reload();
        return;
      }
    }catch(e){
      setMessage('Browser storage is unavailable. Enable site storage to sign in.',true);
      return;
    }
    var accountEmail=document.getElementById('accountEmail');
    if(accountEmail) accountEmail.textContent=session.user.email||'Account';
    gate.hidden=true;
  }
  function emailAndPassword(){
    return {email:emailInput.value.trim(),password:passwordInput.value};
  }
  function showRequestError(error){
    setMessage(error&&error.message?error.message:'Authentication failed. Try again.',true);
  }
  function busy(value){
    submitButton.disabled=value;
    signUpButton.disabled=value;
    resetButton.disabled=value;
  }

  form.addEventListener('submit',function(event){
    event.preventDefault();
    var values=emailAndPassword();
    setMessage('');
    busy(true);

    if(mode==='reset'){
      request('/auth/v1/recover?redirect_to='+encodeURIComponent(location.origin+location.pathname),{
        body:{email:values.email}
      }).then(function(){
        setMessage('If an account exists for that email, a password reset link has been sent.');
      }).catch(showRequestError).then(function(){ busy(false); });
      return;
    }
    if(mode==='new-password'){
      request('/auth/v1/user',{
        method:'PUT',
        headers:{Authorization:'Bearer '+recoveryToken},
        body:{password:values.password}
      }).then(function(){
        history.replaceState(null,'',location.pathname+location.search);
        recoveryToken='';
        setMode('signin');
        setMessage('Password updated. Sign in with your new password.');
      }).catch(showRequestError).then(function(){ busy(false); });
      return;
    }

    var endpoint=mode==='signup'?'/auth/v1/signup':'/auth/v1/token?grant_type=password';
    request(endpoint,{body:values}).then(function(data){
      var session=sessionFrom(data);
      if(session){
        activate(session);
      }else if(mode==='signup'){
        setMessage('Account created. Check your email to confirm it, then sign in.');
      }else{
        setMessage('Sign-in succeeded but no session was returned.',true);
      }
    }).catch(showRequestError).then(function(){ busy(false); });
  });

  signUpButton.addEventListener('click',function(){
    setMode('signup');
    setMessage('');
    passwordInput.focus();
  });
  resetButton.addEventListener('click',function(){
    setMode('reset');
    setMessage('');
    emailInput.focus();
  });
  backButton.addEventListener('click',function(){
    setMode('signin');
    setMessage('');
    emailInput.focus();
  });
  document.getElementById('btnSignOut').addEventListener('click',function(){
    var session=readSession();
    var warning='';
    var signedOut=session&&session.access_token
      ?request('/auth/v1/logout',{headers:{Authorization:'Bearer '+session.access_token}})
      :Promise.resolve();
    signedOut.catch(function(error){
      warning='Signed out on this device, but Supabase could not revoke the remote session: '+error.message;
    }).then(function(){
      if(clearSession()){
        if(warning){
          try{ window.localStorage.setItem(SIGNOUT_NOTICE_KEY,warning); }catch(e){}
        }
        window.location.reload();
      }
    });
  });

  function validConfig(){
    return /^https:\/\//i.test(baseUrl)&&!!anonKey;
  }
  function bootstrap(){
    if(!validConfig()){
      setMessage('Set your Supabase Project URL and publishable/anon key in auth-config.js to enable sign-in.',true);
      busy(true);
      return;
    }
    try{
      var notice=window.localStorage.getItem(SIGNOUT_NOTICE_KEY);
      if(notice){
        window.localStorage.removeItem(SIGNOUT_NOTICE_KEY);
        setMessage(notice,true);
      }
    }catch(e){}
    var params=new URLSearchParams(location.hash.replace(/^#/,''));
    var callbackToken=params.get('access_token');
    if(params.get('type')==='recovery'&&callbackToken){
      recoveryToken=callbackToken;
      setMode('new-password');
      return;
    }
    var session=readSession();
    if(!session||!session.access_token||!session.user||!session.user.id) return;
    var now=Math.floor(Date.now()/1000);
    if(session.expires_at>now+60){
      activate(session);
      return;
    }
    if(!session.refresh_token) return;
    request('/auth/v1/token?grant_type=refresh_token',{body:{refresh_token:session.refresh_token}})
      .then(function(data){
        var refreshed=sessionFrom(data);
        if(refreshed) activate(refreshed);
        else { clearSession(); setMessage('Your sign-in session expired. Please sign in again.',true); }
      })
      .catch(function(error){
        if(error.network&&session.expires_at>now){
          activate(session);
        }else{
          clearSession();
          showRequestError(error);
        }
      });
  }

  setMode('signin');
  bootstrap();
})();
