import axios from 'axios';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import vcard from 'vcard-parser';
dotenv.config();
const sid = process.env.TWILIO_ACCOUNT_SID;
const token = process.env.TWILIO_AUTH_TOKEN;
const prisma = new PrismaClient();
export const checkContact = async (vcfUrl) => {
axios({
    method: 'get',
    url: vcfUrl,
    auth: {
        username: sid,
        password: token,
    }
})
    .then(async function (response) {
        let card = vcard.parse(vcfData);
        let phoneNumbers= await card.tel.map((number)=>number.value);
        phoneNumbers.map(async(number)=>{
            let contact = await prisma.contact.findFirst({
                where:{
                    phoneNumber:number
                }
            });
            if(contact){
                console.log(`Contact ${contact.name} already exists`);
            }else{
                console.log(`Contact does not exist, creating new contact`);
                await prisma.contact.create({
                    data:{
                        name:card.fn,
                        phoneNumber:card.tel.map((number)=>number.value),
                    }
                });
            }
        })
    })
};
export const extractNumbersFromVcf = async (vcfData) =>{
    let card = vcard.parse(vcfData);
    return 
}