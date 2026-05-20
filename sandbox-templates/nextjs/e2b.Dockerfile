FROM node:21-slim

RUN apt-get update && apt-get install -y curl && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY compile_page.sh /compile_page.sh
RUN chmod +x /compile_page.sh

WORKDIR /home/user/nextjs-app

RUN npx --yes create-next-app@15.3.3 . --yes

# Install semua dependency yang dibutuhkan
RUN npm install tw-animate-css tailwind-merge clsx

RUN npx --yes shadcn@2.6.3 init --yes -b neutral --force
RUN npx --yes shadcn@2.6.3 add --all --yes

COPY utils.ts /home/user/nextjs-app/lib/utils.ts

RUN mv /home/user/nextjs-app/* /home/user/ && rm -rf /home/user/nextjs-app

WORKDIR /home/user

EXPOSE 3000
CMD ["/compile_page.sh"]