import axios from 'axios';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();
const sid = process.env.TWILIO_ACCOUNT_SID;
const token = process.env.TWILIO_AUTH_TOKEN;
axios({
    method: 'get',
    url: 'https://api.twilio.com/2010-04-01/Accounts/AC34469a23a18767651e6c8367085ecba8/Messages/MM8969338b0816f96052ce95174f13e54c/Media/MEe046ffc7b4df69d04ed5bd00eb25eb00',
    auth: {
        username: sid,
        password: token,
    }
})
    .then(function (response) {
        console.log(response.data);
    });
