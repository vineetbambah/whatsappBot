import express from 'express';
import axios from 'axios';
import twilio from 'twilio';
import dotenv from 'dotenv';
import vcard from 'vcard-parser';
import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
dotenv.config();
const port = process.env.PORT;
let contact0;
const dbUrl = process.env.DATABASE_URL;
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
let userState = 'unregistered';
let registeredCase = 'vcfNotSent';
const client = twilio(accountSid, authToken);
const prisma = new PrismaClient(
    {datasourceUrl: dbUrl}
);

const app = express();
app.use(express.json());
const checkContact = async (requ,user) => {
    try {
        // Fetch the vCard data
        const resp = await axios({
            method: 'get',
            url: requ.body.MediaUrl0,
            auth: {
                username: accountSid,
                password: authToken,
            },
        });

        // Parse the vCard data
        const card = vcard.parse(resp.data);
        const phoneNumbers = card.tel.map((number) => number.value);

        // Check each phone number in the database
        const contacts = await Promise.all(
            phoneNumbers.map(async (number) => {
                const contact = await prisma.contacts.findFirst({
                    where: {
                        number: {
                            has: number,
                        },
                    },
                });
                return contact; // Return the contact for each number
            })
        );
        if(contacts.indexOf(null) !== -1){
           contact0= await prisma.contacts.create({
                data:{
                    name:card.fn[0].value,
                    number:phoneNumbers,
                    user:{
                        connect:{
                            uid:user.uid
                        }
                    }
                }
            })
            registeredCase = 'askForContext';
            console.log('Contact created');
        }else{
            console.log('Contact already exists');
            message(requ.body.From,`Contact already exists`);
        }
    } catch (error) {
        console.error("Error in checkContact:", error);
    }
};



const message = async (dest,msg) =>{
    client.messages.create(
        {
            from:'whatsapp:+14155238886',
            to: await dest,
            body:msg,
        }
    )
}

app.use(express.urlencoded({ extended: true }));
app.get('/', (req, res) => {
    res.send('Hello World');
});

app.post('/webhook', (req, res) => {
    const sender = req.body.From;
    const body = req.body.Body;
    res.status(200).send('Webhook received');
});

app.post('/spiderman', async (req, res) => {
    const sender = req.body.From.replace('whatsapp:','');
    const user = await prisma.users.findFirst({
        where:{number:sender},
    })
    if(!user){
        userState = 'onboarding1';
    }else if(user && userState === 'onboarding1'){
        userState = 'onboarding2';
    }else{
        userState = 'registered';
    }
    
    switch(userState){
        case 'onboarding1':
            console.log('Creating new user');
            try {
                const newUser = await prisma.users.create({
                  data: {
                    name:'Being Set',
                    number: sender,
                  },
                });
                console.log("User created:", newUser);
              } catch (error) {
                console.error("Error creating user:", error);
              }
            break;
        case 'onboarding2':
            message(req.body.From,`Hello! I see it's your first time here. Please enter your name.`);
            console.log('Updating name');
            await prisma.users.update({
                where:{
                    uid:user.uid
                },
                data:{
                    name:req.body.Body
                }
            });
            message(req.body.From,`Welcome ${req.body.Body}! Please send a contact file to get started`);
            break;
        case 'registered':
            console.log('User is registered');
            if(registeredCase !== 'askForContext' && registeredCase !== 'askForFrequency'){
                if(req.body.MediaContentType0 !== 'text/vcard'){
                    message(req.body.From,`Please send a vcf file to get started`);
                    registeredCase = 'vcfNotSent';
                    break;
                }else{
                    registeredCase = 'vcfSent';
                }
            }
            switch(registeredCase){
                case 'vcfSent':
                    console.log('Vcf Sent');
                    checkContact(req,user);
                    message(req.body.From,`Thank you! How do you know this contact? Provide a little context`);
                    break;
                case 'askForContext':
                    console.log(`Asking for context`);
                    console.log(contact0);
                    await prisma.contacts.update({
                        where:{
                            id:contact0.id
                        },
                        data:{
                            context:req.body.Body
                        }
                    })
                    console.log(prisma.contacts.update({
                        where:{
                            id:contact0.id
                        },
                        data:{
                            context:req.body.Body
                        }
                    }));
                    console.log(contact0);
                    message(req.body.From,`Thank you! How often would you like to be reminded?(enter integer in minutes)`);
                    registeredCase = 'askForFrequency';
                    break;
                case 'askForFrequency':
                    console.log('Asking for frequency');
                    message(req.body.From,`Thank you! You will be reminded every ${req.body.Body} minute`);
                    console.log(`Frequency: ${req.body.Body}`);
                    console.log(`Date:{${new Date()}}`);
                    await prisma.contacts.update({
                        where:{
                            id:contact0.id
                        },
                        data:{
                            frequency:parseInt(req.body.Body),
                            dateToMessage:(new Date(new Date().getTime() + parseInt(req.body.Body) * 60000))
                        }
                    })
                    registeredCase='vcfNotSent'
                    break;
                case 'vcfNotSent':
                    break;
            }
    }
})

cron.schedule("* * * * *", async () => {
    const currentDate = new Date();
  
    // Find records where `messageOn` has passed and the message hasn't been sent yet
    const messagesToSend = await prisma.contacts.findMany({
      where: {
        dateToMessage: {
          lte: currentDate, // `messageOn` is less than or equal to the current time
        },
        sent: false, // Only unsent messages
      },
    });
    console.log(messagesToSend)
    // Send messages and mark them as sent
    for (const mess of messagesToSend) {
        let sender = await prisma.users.findFirst({
            where:{uid:mess.userid}
        })
        console.log(sender.number)
      await message(`whatsapp:${sender.number}`, `You should talk to ${mess.name} today.`);
      console.log('sending message')
      // Update the record to mark it as sent
      await prisma.contacts.update({
        where: { id: mess.id },
        data: {
            dateToMessage:(new Date(new Date().getTime() + mess.frequency * 60000))
        },
      });
    }
  });
  
  console.log("Cron job started...");

app.listen(3000, () => { console.log(`Server is running on port ${port}`) });