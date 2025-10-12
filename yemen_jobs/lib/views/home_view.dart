import 'package:flutter/material.dart';

class HomeView extends StatelessWidget {
  const HomeView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Yemen Jobs'),
      ),
      body: const Center(
        child: Text('Welcome to the Yemen Jobs platform!'),
      ),
    );
  }
}
