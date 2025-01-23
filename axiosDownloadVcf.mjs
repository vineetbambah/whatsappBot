import axios from 'axios';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();
const sid = process.env.TWILIO_ACCOUNT_SID;
const token = process.env.TWILIO_AUTH_TOKEN;
const getMobileNumbers = (vcfData) => {
    let mobileNumbers = [];
    let lines = vcfData.split(/\r?\n/);
    lines.forEach((line) => {
        if (line.includes('TEL;')) {
            let mobileNumber = line.split(':')[1];
            mobileNumbers.push(mobileNumber);
            mobileNumbers.map((number)=>{
                number.trim();
            })
        }
    });
    console.log(mobileNumbers);
}
export const getVcf = async (vcfUrl) => {
    console.log(vcfUrl);
axios({
    method: 'get',
    url: vcfUrl,
    auth: {
        username: sid,
        password: token,
    }
})
    .then(function (response) {
        console.log(response.data);
        getMobileNumbers(response.data);
    });
};