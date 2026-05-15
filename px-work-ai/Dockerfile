FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /build

COPY pom.xml ./
COPY px_work-api/pom.xml px_work-api/pom.xml
COPY px_work-common/pom.xml px_work-common/pom.xml
COPY px_work-system/pom.xml px_work-system/pom.xml
COPY px_work-course/pom.xml px_work-course/pom.xml
COPY px_work-resource/pom.xml px_work-resource/pom.xml

COPY px_work-api/src px_work-api/src
COPY px_work-common/src px_work-common/src
COPY px_work-system/src px_work-system/src
COPY px_work-course/src px_work-course/src
COPY px_work-resource/src px_work-resource/src

RUN mvn -pl px_work-api -am clean package -DskipTests

FROM eclipse-temurin:17-jre
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends libreoffice fonts-noto-cjk fontconfig \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /app/uploads

COPY --from=build /build/px_work-api/target/px_work-api-1.0.0-SNAPSHOT.jar /app/app.jar

EXPOSE 8082

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
